# Trusted private-storage helper. No execution-policy override, elevation, shell
# interpolation, or repair of existing ACLs. Windows PowerShell/.NET Framework.
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $systemSid = 'S-1-5-18'
  $trustedOwners = @($sid, $systemSid, 'S-1-5-32-544', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
  function Fail-Private { throw 'unsafe_storage' }
  function Read-DirectoryAcl([string]$location) {
    $attributes = [IO.File]::GetAttributes($location)
    if (($attributes -band [IO.FileAttributes]::Directory) -eq 0 -or ($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Fail-Private }
    return [IO.Directory]::GetAccessControl($location)
  }
  function Assert-Ancestor([string]$location) {
    $acl = Read-DirectoryAcl $location
    if ($trustedOwners -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value) { Fail-Private }
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if ($rules.Count -eq 0) { Fail-Private } # Null DACL is not private.
    foreach ($rule in $rules) {
      if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0) { continue }
      if ($trustedOwners -contains $rule.IdentityReference.Value) { continue }
      # Safe read/traverse rights, including generic read/execute. Volume roots
      # may permit creating names, but not deleting/changing existing ancestors.
      $safe = [int64]1179817 -bor [int64]2147483648 -bor [int64]536870912
      if ($location.TrimEnd('\') -ieq ([IO.Path]::GetPathRoot($location)).TrimEnd('\')) { $safe = $safe -bor 6 }
      $rights = ([int64]$rule.FileSystemRights) -band [int64]4294967295
      if (($rights -band (-bnot $safe)) -ne 0) { Fail-Private }
    }
  }
  function Assert-Private([string]$location) {
    $acl = Read-DirectoryAcl $location
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid -or -not $acl.AreAccessRulesProtected) { Fail-Private }
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])); $ownerFull = $false
    foreach ($rule in $rules) {
      if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or @($sid, $systemSid) -notcontains $rule.IdentityReference.Value) { Fail-Private }
      if ($rule.IdentityReference.Value -eq $sid -and (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) -and (($rule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit') -eq [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit') -and $rule.PropagationFlags -eq [Security.AccessControl.PropagationFlags]::None) { $ownerFull = $true }
    }
    if (-not $ownerFull) { Fail-Private }
  }
  function New-PrivateSecurity {
    $security = [Security.AccessControl.DirectorySecurity]::new()
    $security.SetOwner([Security.Principal.SecurityIdentifier]::new($sid))
    $security.SetAccessRuleProtection($true, $false)
    foreach ($identity in @($sid, $systemSid)) {
      $rule = [Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($identity), [Security.AccessControl.FileSystemRights]::FullControl, [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit', [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
      $security.AddAccessRule($rule)
    }
    return $security
  }
  function Ensure-PrivateDirectory([string]$target) {
    $absolute = [IO.Path]::GetFullPath($target)
    if ($absolute -notmatch '^[A-Za-z]:\\' -or $absolute.TrimEnd('\') -ieq ([IO.Path]::GetPathRoot($absolute)).TrimEnd('\')) { Fail-Private }
    $current = [IO.Path]::GetPathRoot($absolute); Assert-Ancestor $current
    $parts = $absolute.Substring($current.Length).Split([char]'\', [StringSplitOptions]::RemoveEmptyEntries)
    foreach ($part in $parts) {
      $current = [IO.Path]::Combine($current, $part)
      if (-not [IO.Directory]::Exists($current)) {
        # This official overload passes the protected descriptor at creation.
        # A raced existing directory is checked; its ACL is never rewritten.
        $null = [IO.Directory]::CreateDirectory($current, (New-PrivateSecurity))
      }
      Assert-Ancestor $current
    }
    Assert-Private $current
    return $current
  }
  function Hash-Text([string]$value) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
  }
  if ($env:PLAYWRIGHT_PRIVATE_OWNER_HASH -notmatch '^[0-9a-f]{64}$') { Fail-Private }
  $projectId = Hash-Text ($sid + ':' + $env:PLAYWRIGHT_PRIVATE_PROJECT)
  $base = Ensure-PrivateDirectory $env:PLAYWRIGHT_PRIVATE_BASE
  $project = Ensure-PrivateDirectory ([IO.Path]::Combine($base, 'projects', $projectId))
  $journal = Ensure-PrivateDirectory ([IO.Path]::Combine($project, 'journal'))
  $artifacts = Ensure-PrivateDirectory ([IO.Path]::Combine($project, 'artifacts', $env:PLAYWRIGHT_PRIVATE_OWNER_HASH))
  [Console]::WriteLine((@{ok=$true;ownerSid=$sid;projectId=$projectId;directory=$journal;artifactsDir=$artifacts}|ConvertTo-Json -Compress))
} catch {
  [Console]::WriteLine('{"ok":false,"code":"unsafe_storage"}')
  exit 1
}
