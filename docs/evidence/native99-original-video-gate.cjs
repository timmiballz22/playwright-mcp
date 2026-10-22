        const fs = require('node:fs');
        let eligible = false, inspectedBytes = 0, truncated = false;
        for (const name of ['wrapper-tests.log', 'wrapper-available-tests.log']) {
          if (!fs.existsSync(name)) continue;
          const fd = fs.openSync(name, 'r');
          let bytes;
          try {
            const size = fs.fstatSync(fd).size, length = Math.min(size, 2 * 1024 * 1024);
            bytes = Buffer.alloc(length); fs.readSync(fd, bytes, 0, length, size - length);
            inspectedBytes += length; truncated ||= size > length;
          } finally { fs.closeSync(fd); }
          for (const raw of bytes.toString('utf8').split('\n')) {
            const line = raw.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').trim();
            let data; try { data = JSON.parse(line); } catch { continue; }
            if (data?.fixture === 'owned_video_original_decode_failure' && data.project === 'chromium' && data.width === 320 && data.height === 240 && Number.isInteger(data.ready) && data.ready >= 2 && data.ready <= 4 && Array.isArray(data.pixel) && data.pixel.length === 4 && data.pixel.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) eligible = true;
          }
        }
        console.log(JSON.stringify({ fixture: 'video_first_frame_control_gate', eligible, inspectedBytes, truncated }));
        process.exitCode = eligible ? 0 : 1;
