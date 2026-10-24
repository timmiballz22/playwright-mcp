from pathlib import Path
import json,re
p=Path('/tmp');records=json.load(open(p/'native96-wrapper-structured-receipts.json'));frames=[r for r in records if r['data'].get('fixture')=='owned_video_encoder_input'];short=[r for r in frames if r['data']['height']!=240 or r['data']['width']!=320]
blocks=[]
for f in p.glob('native96-wrapper-job-*.log'):
 lines=f.read_text().splitlines()
 for i,line in enumerate(lines):
  if '"fixture":"owned_video_encoder_input"' not in line or '"frame":1,' not in line:continue
  try:first=json.JSONDecoder().raw_decode(line[line.index('{'):])[0]
  except:continue
  if first['height']==240 and first['width']==320:continue
  nearby=[]
  for j in range(max(0,i-6),min(len(lines),i+35)):
   msg=re.sub(r'^.*?\d{4}-\d\d-\d\dT\S+Z ?', '',lines[j])
   if any(s in msg for s in ['owned_video_source_paint','owned_video_encoder_input','owned_video_original_decode_failure','owned_video_independent_first_frame','owned_video_http_failure']):nearby.append({'line':j+1,'message':msg})
  blocks.append({'file':f.name,'firstFrameLine':i+1,'firstFrame':first,'nearbyFixedReceipts':nearby})
proof={'source':'cc9562b8ab38a0a2ba6ca7de7d8a0d0a5f32026f','scope':'Actual first JPEG SOF headers forwarded unchanged to ffmpeg. Native96 input receipts include project attributes; both short blocks report chromium (one main and one fresh control). Raw adjacency is retained. This is input-size evidence, not measured browser window bounds or proof of the viewport-order cause.','inputFrameRecords':len(frames),'shortInputFrameRecords':len(short),'shortBlocks':blocks,'sizeCounts':{f'{w}x{h}':sum(r['data']['width']==w and r['data']['height']==h for r in frames) for w,h in sorted({(r['data']['width'],r['data']['height']) for r in frames})},'encoderPadding':'Reviewed real encoder applies pad=320:240:0:0:gray,crop=320:240:0:0. Positions y100 and y239 lie outside98-high input; independent encoded frame zero is gray there. No Matroska/header/frame-skip change follows.'}
(p/'native96-video-input-native-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
chosen=[r for r in records if r['data'].get('fixture','').startswith(('owned_video_','stock_','owned_pcm'))];(p/'native96-original-diagnostic-projection.json').write_text(json.dumps(chosen,indent=2)+'\n');print(json.dumps({'inputFrames':len(frames),'shortFrames':len(short),'shortStreams':len(blocks),'sizes':proof['sizeCounts']}))
