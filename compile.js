// D:\Desktop\backup\compile-main.js
const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// __dirname is D:\Desktop\backup\ since compile-main.js is in the root.
const filesToCompile = [
  {
    input: path.join(__dirname, 'main.js'),        
    output: path.join(__dirname, 'main.jsc')       
  },
  {
    // ADD PRELOAD HERE
    input: path.join(__dirname, 'preload.js'),      
    output: path.join(__dirname, 'preload.jsc')     
  }
];

async function compileAllFiles() {
  console.log('Starting bytecode compilation...');
  let allSuccessful = true;

  const apiRoot = path.join(__dirname, 'watch-zone-api');
  const animeBundle = path.join(apiRoot, 'anime', 'index.bundle.cjs');
  try {
    await esbuild.build({
      entryPoints: [path.join(apiRoot, 'anime', 'index.js')],
      outfile: animeBundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      packages: 'external'
    });
    const apiFiles = [
      { input: animeBundle, output: path.join(apiRoot, 'anime', 'index.jsc') },
      ...['script', 'vidsrc', 'server'].map(name => ({
        input: path.join(apiRoot, 'movie', `${name}.js`),
        output: path.join(apiRoot, 'movie', `${name}.jsc`)
      }))
    ];
    for (const file of apiFiles) {
      await bytenode.compileFile({ filename: file.input, output: file.output, electron: true });
      console.log(`Successfully compiled ${file.input}`);
    }
  } catch (error) {
    console.error('Watch Zone API compilation failed:', error);
    allSuccessful = false;
  } finally {
    if (fs.existsSync(animeBundle)) fs.unlinkSync(animeBundle);
  }

  for (const file of filesToCompile) {
    // Ensure output directory exists if it's different from input directory
    const outputDir = path.dirname(file.output);
    if (!fs.existsSync(outputDir)) {
        try {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`Created output directory: ${outputDir}`);
        } catch (err) {
            console.error(`Error creating output directory ${outputDir}:`, err);
            allSuccessful = false;
            continue;
        }
    }


    if (!fs.existsSync(file.input)) {
      console.error(`Error: Source file ${file.input} not found!`);
      allSuccessful = false;
      continue; // Skip to the next file
    }

    console.log(`Compiling ${file.input} to ${file.output}...`);
    try {
      await bytenode.compileFile({
        filename: file.input,
        output: file.output,
        electron: true, // IMPORTANT: This flag is crucial for Electron compatibility
      });
      console.log(`Successfully compiled ${file.input}`);
    } catch (err) {
      console.error(`Compilation failed for ${file.input}:`, err);
      allSuccessful = false;
    }
  }

  if (allSuccessful) {
    console.log('All files compiled successfully!');
  } else {
    console.error('Some files failed to compile. Please check the errors above.');
    process.exit(1); // Exit with an error code if any compilation failed
  }
}

compileAllFiles();
