import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import RunwayML from '@runwayml/sdk';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8080;

function runwayClient() {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error('Runway API kaliti sozlanmagan.');
  }
  return new RunwayML({
    apiKey: process.env.RUNWAYML_API_SECRET
  });
}

app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VIDZA — AI Video</title>
<style>
body{margin:0;padding:24px 14px;background:#0b0b12;color:white;font-family:Arial,sans-serif}
main{max-width:600px;margin:auto}
h1{text-align:center;font-size:38px}
.sub{text-align:center;color:#aaa}
.panel{background:#171722;border:1px solid #303040;padding:22px;border-radius:18px}
label{display:block;margin:18px 0 8px;font-weight:bold}
textarea,select,input{width:100%;padding:13px;border-radius:10px;border:1px solid #414154;background:#101019;color:white;font-size:16px;box-sizing:border-box}
textarea{min-height:130px}
button{width:100%;margin-top:22px;padding:15px;border:0;border-radius:11px;background:#7657ff;color:white;font-size:17px;font-weight:bold}
#status{margin-top:18px;overflow-wrap:anywhere;line-height:1.6}
a{color:#b5a6ff}
</style>
</head>
<body>
<main>
<h1>🎬 VIDZA</h1>
<p class="sub">Hikoyangni videoga aylantir</p>
<div class="panel">
<form id="videoForm">
<label for="story">Hikoyang</label>
<textarea id="story" name="story" required placeholder="Hikoyangni shu yerga yoz..."></textarea>
<label for="style">Video uslubi</label>
<select id="style" name="style">
<option value="realistic">Realistik</option>
<option value="romantic">Romantik</option>
<option value="cartoon">Multfilm</option>
</select>
<label for="image">Rasm yuklash (ixtiyoriy)</label>
<input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp">
<button id="submitBtn" type="submit">🎥 Video yaratish</button>
</form>
<div id="status" role="status"></div>
</div>
</main>
<script>
const form=document.getElementById('videoForm');
const button=document.getElementById('submitBtn');
const statusBox=document.getElementById('status');

form.addEventListener('submit',async function(event){
 event.preventDefault();
 button.disabled=true;
 statusBox.textContent='So‘rov yuborilmoqda...';
 try{
  const response=await fetch('/api/generate',{method:'POST',body:new FormData(form)});
  const result=await response.json();
  if(!response.ok||!result.ok||!result.taskId)throw new Error(result.error||'So‘rov bajarilmadi');
  statusBox.textContent='Video tayyorlanmoqda...';
  for(let i=0;i<60;i++){
   await new Promise(resolve=>setTimeout(resolve,5000));
   const check=await fetch('/api/status/'+encodeURIComponent(result.taskId));
   const task=await check.json();
   if(!check.ok||!task.ok)throw new Error(task.error||'Holatni tekshirib bo‘lmadi');
   if(task.status==='succeeded'){
    let outputs=Array.isArray(task.output)?task.output:[];
    let url=outputs.find(item=>typeof item==='string'&&item.startsWith('http'));
    if(!url){const item=outputs.find(x=>x&&typeof x.url==='string');if(item)url=item.url;}
    if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='🎬 Tayyor videoni ochish';statusBox.textContent='Video tayyor! ';statusBox.appendChild(link);}
    else statusBox.textContent='Video tayyor, ammo havola topilmadi.';
    return;
   }
   if(task.status==='failed'||task.status==='cancelled')throw new Error('Video yaratish muvaffaqiyatsiz tugadi.');
   statusBox.textContent='Video tayyorlanmoqda... Holati: '+task.status;
  }
  statusBox.textContent='Jarayon davom etmoqda. Keyinroq qayta tekshiring. Task ID: '+result.taskId;
 }catch(error){statusBox.textContent='Xatolik: '+error.message;}
 finally{button.disabled=false;}
});
</script>
</body>
</html>`);
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'VIDZA',
    creator: 'Sayidbek',
    runwayConfigured: Boolean(process.env.RUNWAYML_API_SECRET)
  });
});

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const story = String(req.body.story || '').trim();
    const style = String(req.body.style || 'realistic').trim();

    if (!story) {
      return res.status(400).json({
        ok: false,
        error: 'Hikoya yozilmagan.'
      });
    }

    const styleMap = {
      realistic: 'realistic cinematic short film, natural human motion, realistic lighting',
      romantic: 'romantic cinematic short film, warm soft lighting, gentle camera movement, emotional atmosphere',
      cartoon: 'stylized animated short film, polished 3D cartoon look, expressive motion'
    };

    const payload = {
      model: 'gen4.5',
      promptText: (styleMap[style] || styleMap.realistic) +
        '. Preserve the identity and recognizable facial features of the supplied reference image. Scene/story: ' + story,
      ratio: '720:1280',
      duration: 5
    };

    if (req.file) {
      payload.promptImage = 'data:' + req.file.mimetype +
        ';base64,' + req.file.buffer.toString('base64');
    }

    const task = await runwayClient().imageToVideo.create(payload);
    res.json({ ok: true, taskId: task.id, status: 'submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err?.message || 'Runway so‘rovi bajarilmadi.'
    });
  }
});

app.get('/api/status/:id', async (req, res) => {
  try {
    const task = await runwayClient().tasks.retrieve(req.params.id);
    const output = Array.isArray(task?.output)
      ? task.output
      : task?.output ? [task.output] : [];

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
      error: err?.message || 'Video holatini tekshirishda xato.'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('VIDZA backend listening on port ' + PORT);
});
