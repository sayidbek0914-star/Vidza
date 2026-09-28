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
