const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const htmlPath = path.resolve(__dirname, 'NEX EMS Redesign (Standalone).html');
const outputDir = path.resolve(__dirname, 'unpacked');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Reading ' + htmlPath + '...');
const content = fs.readFileSync(htmlPath, 'utf8');

// Extract manifest
const manifestMatch = content.match(/<script type="__bundler\/manifest">(.*?)<\/script>/s);
if (!manifestMatch) {
  console.error('Could not find manifest!');
  process.exit(1);
}
const manifestJson = JSON.parse(manifestMatch[1].trim());

// Extract template
const templateMatch = content.match(/<script type="__bundler\/template">(.*?)<\/script>/s);
if (!templateMatch) {
  console.error('Could not find template!');
  process.exit(1);
}
const templateStr = JSON.parse(templateMatch[1].trim());

// Extract ext_resources
const extMatch = content.match(/<script type="__bundler\/ext_resources">(.*?)<\/script>/s);
const extResources = extMatch ? JSON.parse(extMatch[1].trim()) : [];

console.log('Unpacking ' + Object.keys(manifestJson).length + ' assets...');

for (const [uuid, entry] of Object.entries(manifestJson)) {
  let data = Buffer.from(entry.data, 'base64');
  if (entry.compressed) {
    try {
      data = zlib.gunzipSync(data);
    } catch (err) {
      console.error('Failed to decompress ' + uuid + ':', err);
    }
  }

  // Determine file extension
  const mime = entry.mime;
  let ext = 'bin';
  if (mime.includes('javascript') || mime.includes('json')) {
    ext = 'js';
  } else if (mime.includes('css')) {
    ext = 'css';
  } else if (mime.includes('html')) {
    ext = 'html';
  } else if (mime.includes('png')) {
    ext = 'png';
  } else if (mime.includes('svg')) {
    ext = 'svg';
  } else if (mime.includes('woff2')) {
    ext = 'woff2';
  }

  const filename = `${uuid}.${ext}`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, data);
  console.log('Saved ' + filename + ' (' + data.length + ' bytes)');
}

fs.writeFileSync(path.join(outputDir, 'template.html'), templateStr, 'utf8');

const metadata = {
  ext_resources: extResources,
  manifest_info: {}
};
for (const [uuid, entry] of Object.entries(manifestJson)) {
  metadata.manifest_info[uuid] = {
    mime: entry.mime,
    compressed: !!entry.compressed
  };
}
fs.writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

console.log('Unpacking complete!');
