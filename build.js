const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Читаем конфигурационный файл neutralino.config.json
const configPath = path.join(__dirname, 'neutralino.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const version = config.version;          // Достаем версию (например, "0.9.3")
const binaryName = config.cli.binaryName; // Достаем базовое имя (например, "myapp")

console.log(`📦 Запуск сборки для ${binaryName} v${version}...`);

try {
    // 2. Запускаем стандартную сборку Neutralino
    execSync('neu build', { stdio: 'inherit' });
    
    // 3. Путь к папке, куда Neutralino сохранил готовые бинарники
    const distPath = path.join(__dirname, 'dist', binaryName);
    
    if (fs.existsSync(distPath)) {
        // Читаем все файлы в папке сборки
        const files = fs.readdirSync(distPath);
        
        console.log('\n⚙️  Переименование файлов под версию...');
        
        files.forEach(file => {
            const oldPath = path.join(distPath, file);
            
            // Проверяем, начинается ли файл с имени нашего бинарника
            if (file.startsWith(binaryName)) {
                // Вставляем версию сразу после основного имени
                const newFileName = file.replace(binaryName, `${binaryName}-v${version}`);
                const newPath = path.join(distPath, newFileName);
                
                fs.renameSync(oldPath, newPath);
                console.log(` ✅ ${file} -> ${newFileName}`);
            }
        });
        console.log('\n🎉 Сборка успешно завершена и переименована!');
    } else {
        console.error(`❌ Ошибка: Папка ${distPath} не найдена после сборки.`);
    }
} catch (error) {
    console.error('❌ Ошибка во время сборки:', error.message);
}
