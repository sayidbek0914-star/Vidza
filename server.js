import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import RunwayML from '@runwayml/sdk';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VIDZA — AI Video</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0; padding: 24px 14px; min-height: 100vh;
          background: #0b0b12; color: white;
          font-family: Arial, sans-serif;
        }
        main { max-width: 600px; margin: auto; }
        h1 { text-align: center; font-size: 38px; margin-bottom: 8px; }
        .sub { text-align: center; color: #aaa; margin-bottom: 28px; }
        .panel {
          background: #171722; border: 1px solid #303040;
          padding: 22px; border-radius: 18px;
        }
        label { display: block; margin: 18px 0 8px; font-weight: bold; }
        textarea, select, input[type=file] {
          width: 100%; padding: 13px; border-radius: 10px;
          border: 1px solid #414154; background: #101019;
          color: white; font-size: 16px;
        }
        textarea { min-height: 130px; resize: vertical; }
        button {
          width: 100%; margin-top: 22px; padding: 15px;
          border: 0; border-radius: 11px; background: #7657ff;
          color: white; font-size: 17px; font-weight: bold;
        }
        button:disabled { opacity: .6; }
        #status { margin-top: 18px; line-height: 1.6; overflow-wrap: anywhere; }
        a { color: #b5a6ff; }
        .note { color: #aaa; font-size: 13px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <main>
        <h1>🎬 VIDZA</h1>
        <p class="sub">Hikoyangni videoga aylantir</p>

        <div class="panel">
          <form id="videoForm">
            <label for="story">Hikoyang</label>
            <textarea id="story" name="story" required
              placeholder="Masalan: Sayidbek va Ozoda maktabda ilk bor ko‘z urishtirishdi..."></textarea>

            <label for="style">Video uslubi</label>
            <select id="style" name="style">
              <option value="realistic">Realistik</option>
              <option value="romantic">Romantik</option>
              <option value="cartoon">Multfilm</option>
            </select>

            <label for="image">Rasm yuklash (ixtiyoriy)</label>
            <input id="image" name="image" type="file"
              accept="image/jpeg,image/png,image/webp">
            <p class="note">Birinchi sinov uchun bitta rasm tanlashing mumkin.</p>

            <button id="submitBtn" type="submit">🎥 Video yaratish</button>
          </form>

          <div id="status" role="status" aria-live="polite"></div>
        </div>
      </main>

      <script>
        var form = document.getElementById('videoForm');
        var button = document.getElementById('submitBtn');
        var statusBox = document.getElementById('status');

        form.addEventListener('submit', async function(event) {
          event.preventDefault();
          button.disabled = true;
          statusBox.textContent = 'So‘rov yuborilmoqda...';

          try {
            var data = new FormData(form);
            var response = await fetch('/api/generate', {
              method: 'POST',
              body: data
            });
            var result = await response.json();

            if (!response.ok || !result.ok || !result.taskId) {
              throw new Error(result.error || 'Video yaratish so‘rovi bajarilmadi.');
            }

            statusBox.textContent = 'So‘rov qabul qilindi. Video tayyorlanmoqda...';
            var finished = false;

            for (var i = 0; i < 60; i++) {
              await new Promise(function(resolve) {
                setTimeout(resolve, 5000);
              });

              var check = await fetch(
                '/api/status/' + encodeURIComponent(result.taskId)
              );
              var task = await check.json();

              if (!check.ok || !task.ok) {
                throw new Error(task.error || 'Video holatini tekshirib bo‘lmadi.');
              }

              if (task.status === 'succeeded') {
                var outputs = Array.isArray(task.output) ? task.output : [];
                var url = outputs.find(function(item) {
                  return typeof item === 'string' &&
                    /^https?:\\/\\//i.test(item);
                });

                if (!url) {
                  url = outputs.find(function(item) {
                    return item && typeof item.url === 'string';
                  });
                  if (url) url = url.url;
                }

                if (url) {
                  var link = document.createElement('a');
                  link.href = url;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  link.textContent = '🎬 Tayyor videoni ochish';
                  statusBox.textContent = 'Video tayyor! ';
                  statusBox.appendChild(link);
                } else {
                  statusBox.textContent =
                    'Video tayyor, ammo natija havolasini aniqlab bo‘lmadi. Task ID: ' +
                    result.taskId;
                }

                finished = true;
                break;
              }

              if (task.status === 'failed' || task.status === 'cancelled') {
                throw new Error('Video yaratish muvaffaqiyatsiz tugadi.');
              }

              statusBox.textContent =
                'Video tayyorlanmoqda... Holati: ' + task.status;
            }

            if (!finished) {
              statusBox.textContent =
                'Jarayon hali davom etishi mumkin. Task ID: ' + result.taskId;
            }
          } catch (error) {
            statusBox.textContent = 'Xatolik: ' + error.message;
          } finally {
            button.disabled = false;
          }
        });
      </script>
    </body>
    </html>
  `);
});
  res.send(`
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vidza</title>
      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: #0b0b0f;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          text-align: center;
        }
        .box {
          width: 90%;
          max-width: 600px;
          padding: 30px;
        }
        h1 {
          font-size: 48px;
          margin-bottom: 10px;
        }
        p {
          color: #aaa;
          font-size: 18px;
        }
        .status {
          margin-top: 25px;
          padding: 15px;
          border-radius: 12px;
          background: #17171f;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>🎬 VIDZA</h1>
        <p>AI video yaratish platformasi</p>
        <div class="status">✅ Server ishlayapti</div>
      </div>
    </body>
    </html>
  `);
});
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'VIDZA',
    creator: 'Sayidbek',
    runwayConfigured: Boolean(process.env.RUNWAYML_API_SECRET)
  });
});

function runwayClient() {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error('RUNWAYML_API_SECRET is not configured on the server.');
  }
  return new RunwayML({ apiKey: process.env.RUNWAYML_API_SECRET });
}

function promptFor(story, style) {
  const styleMap = {
    realistic: 'realistic cinematic short film, natural human motion, realistic lighting, authentic smartphone/camera texture',
    romantic: 'romantic cinematic short film, warm soft lighting, gentle camera movement, emotional atmosphere',
    cartoon: 'stylized animated short film, polished 3D/cartoon look, expressive motion, cinematic lighting'
  };
  return `${styleMap[style] || styleMap.realistic}. Preserve the identity and recognizable facial features of the supplied reference image. Do not replace or redesign the person. Scene/story: ${story}`;
}

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const story = String(req.body.story || '').trim();
    const style = String(req.body.style || 'realistic').trim();

    if (!story) return res.status(400).json({ ok: false, error: 'story is required' });

    const client = runwayClient();
    const payload = {
      model: 'gen4.5',
      promptText: promptFor(story, style),
      ratio: '720:1280',
      duration: 5
    };

    if (req.file) {
      const mime = req.file.mimetype || 'image/jpeg';
      payload.promptImage = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    const task = await client.imageToVideo.create(payload);

    res.json({
      ok: true,
      taskId: task.id,
      status: 'submitted'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Runway request failed'
    });
  }
});

app.get('/api/status/:id', async (req, res) => {
  try {
    const client = runwayClient();
    const task = await client.tasks.retrieve(req.params.id);

    const output =
      Array.isArray(task?.output) ? task.output :
      task?.output ? [task.output] : [];

    res.json({
      ok: true,
      id: task.id,
      status: String(task.status || '').toLowerCase(),
      output
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Could not retrieve task'
    });
  }
});

app.listen(PORT, () => {
  console.log(`VIDZA backend listening on port ${PORT}`);
});
