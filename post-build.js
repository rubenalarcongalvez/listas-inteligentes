const fs = require('fs-extra');
const path = require('path');

// Función para mover archivos de origen a destino
async function moveFiles(source, destination) {
    try {
        const files = await fs.readdir(source);
        for (const file of files) {
            const sourcePath = path.join(source, file);
            const destinationPath = path.join(destination, file);

            await fs.move(sourcePath, destinationPath, { overwrite: true });
        }
        console.log(`Archivos movidos de ${source} a ${destination} exitosamente!`);
    } catch (err) {
        console.error(`Error al mover archivos de ${source} a ${destination}:`, err);
    }
}

// Función para eliminar un directorio
async function removeDirectory(directory) {
    try {
        await fs.remove(directory);
    } catch (err) {
        console.error(`Error al eliminar el directorio ${directory}:`, err);
    }
}

// Definir rutas
const docsPath = 'docs';
const browserPath = path.join(docsPath, 'browser');
const serverPath = path.join(docsPath, 'server');

// Mover archivos y eliminar directorios
async function main() {
    await moveFiles(browserPath, docsPath);
    await removeDirectory(browserPath);
    
    await moveFiles(serverPath, docsPath);
    await removeDirectory(serverPath);
}

main();