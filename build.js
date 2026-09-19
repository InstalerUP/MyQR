// Run in terminal: 'node build.js' in root dir to build the project.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const configPath = path.join(__dirname, 'neutralino.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const version = config.version;
const binaryName = config.cli.binaryName;

/* ==================== ZIP ==================== */

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    return table;
})();

function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
    return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
}

/**
 * Create ZIP
 * @param {string} zipPath
 * @param {{name: string, data: Buffer|string}[]} entries
 */
function createZip(zipPath, entries) {
    const stamp = dosDateTime();
    const parts = [];
    const central = [];
    let offset = 0;

    entries.forEach(({ name, data }) => {
        const nameBuf = Buffer.from(name, 'utf8');
        const raw = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const deflated = zlib.deflateRawSync(raw, { level: 9 });
        const useDeflate = deflated.length < raw.length;
        const payload = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0;
        const crc = crc32(raw);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);   // signature
        local.writeUInt16LE(20, 4);           // version needed to extract
        local.writeUInt16LE(0, 6);            // flags
        local.writeUInt16LE(method, 8);       // compression method
        local.writeUInt16LE(stamp.time, 10);
        local.writeUInt16LE(stamp.date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);           // extra field length

        parts.push(local, nameBuf, payload);

        const dir = Buffer.alloc(46);
        dir.writeUInt32LE(0x02014b50, 0);     // signature
        dir.writeUInt16LE(20, 4);             // version made by
        dir.writeUInt16LE(20, 6);             // version needed
        dir.writeUInt16LE(0, 8);              // flags
        dir.writeUInt16LE(method, 10);
        dir.writeUInt16LE(stamp.time, 12);
        dir.writeUInt16LE(stamp.date, 14);
        dir.writeUInt32LE(crc, 16);
        dir.writeUInt32LE(payload.length, 20);
        dir.writeUInt32LE(raw.length, 24);
        dir.writeUInt16LE(nameBuf.length, 28);
        dir.writeUInt16LE(0, 30);             // extra
        dir.writeUInt16LE(0, 32);             // comment
        dir.writeUInt16LE(0, 34);             // disk number
        dir.writeUInt16LE(0, 36);             // internal attributes
        dir.writeUInt32LE(0, 38);             // external attributes
        dir.writeUInt32LE(offset, 42);        // offset of local header
        central.push(dir, nameBuf);

        offset += local.length + nameBuf.length + payload.length;
    });

    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);         // signature
    end.writeUInt16LE(0, 4);                  // disk number
    end.writeUInt16LE(0, 6);                  // disk with central directory
    end.writeUInt16LE(entries.length, 8);     // entries on this disk
    end.writeUInt16LE(entries.length, 10);    // total entries
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);            // offset of central directory
    end.writeUInt16LE(0, 20);                 // comment length

    fs.writeFileSync(zipPath, Buffer.concat([...parts, centralBuf, end]));
}

console.log(`📦 Running build for ${binaryName} v${version}...`);

try {
    
    execSync('neu build', { stdio: 'inherit' });
    
    
    const distPath = path.join(__dirname, 'dist', binaryName);
    
    if (fs.existsSync(distPath)) {
        
        const files = fs.readdirSync(distPath);
        
        console.log('\n⚙️  Renaming files to match version...');
        
        files.forEach(file => {
            const oldPath = path.join(distPath, file);
            
            
            if (file.startsWith(binaryName) && !file.endsWith('.zip')) {
                
                const newFileName = file.replace(binaryName, `${binaryName}-v${version}`);
                const newPath = path.join(distPath, newFileName);
                
                fs.renameSync(oldPath, newPath);
                console.log(` ✅ ${file} -> ${newFileName}`);
            }
        });
        /* ---- Copy to ZIP ---- */
        const zipName = `${binaryName}-v${version}-win_x64.zip`;
        const archiveFiles = [`${binaryName}-v${version}-win_x64.exe`, 'resources.neu']
            .filter((name) => fs.existsSync(path.join(distPath, name)));

        if (archiveFiles.length === 0) {
            console.warn(`⚠️  Nothing to archive: in ${distPath} no Windows assembly files.`);
        } else {
            const zipPath = path.join(distPath, zipName);
            const zipEntries = archiveFiles.map((name) => ({
                name,
                data: fs.readFileSync(path.join(distPath, name))
            }));

            createZip(zipPath, zipEntries);

            const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
            console.log(`\n🗜️  Archive created: ${zipName} (${sizeMb} MB)`);
        }

        console.log('\n🎉 The build completed successfully and was renamed.!');
    } else {
        console.error(`❌ Error: Folder ${distPath} not found after build.`);
    }
} catch (error) {
    console.error('❌ Error during build:', error.message);
}
