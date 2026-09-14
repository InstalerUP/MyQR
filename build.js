// Run in terminal: 'node build.js' in root dir to build the project.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'neutralino.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const version = config.version;
const binaryName = config.cli.binaryName;

console.log(`📦 Running build for ${binaryName} v${version}...`);

try {
    
    execSync('neu build', { stdio: 'inherit' });
    
    
    const distPath = path.join(__dirname, 'dist', binaryName);
    
    if (fs.existsSync(distPath)) {
        
        const files = fs.readdirSync(distPath);
        
        console.log('\n⚙️  Renaming files to match version...');
        
        files.forEach(file => {
            const oldPath = path.join(distPath, file);
            
            
            if (file.startsWith(binaryName)) {
                
                const newFileName = file.replace(binaryName, `${binaryName}-v${version}`);
                const newPath = path.join(distPath, newFileName);
                
                fs.renameSync(oldPath, newPath);
                console.log(` ✅ ${file} -> ${newFileName}`);
            }
        });
        console.log('\n🎉 The build completed successfully and was renamed.!');
    } else {
        console.error(`❌ Error: Folder ${distPath} not found after build.`);
    }
} catch (error) {
    console.error('❌ Error during build:', error.message);
}
