const fs = require('fs');
const path = require('path');

function logError(source, error) {
    try {
        const currentTime = new Date().toLocaleString();
        const errorMessage = `${currentTime} - Source: ${source}\nError: ${error.stack}\n\n`;
        const logsDir = path.join(__dirname, 'logs');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        const logFilePath = path.join(logsDir, 'error.log');

        fs.appendFile(logFilePath, errorMessage, (err) => {
            if (err) {
                console.error('Ошибка записи в файл:', err);
            } else {
                console.log('Ошибка успешно записана в файл.');
            }
        });
    } catch (error) {
        console.error(error);
    }
}

function logAccess(source, message) {
    try {
        const currentTime = new Date().toLocaleString();
        const accessMessage = `${currentTime} - Source: ${source}\nError: ${error.stack}\n\n`;
        const logsDir = path.join(__dirname, 'logs');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        const logFilePath = path.join(logsDir, 'access.log');

        fs.appendFile(logFilePath, accessMessage, (err) => {
            if (err) {
                console.error('Ошибка записи в файл:', err);
            } else {
                console.log('Сообщение успешно записана в файл.');
            }
        });
    } catch (error) {
        console.error(error);
    }
}

function logSuccess(source, message) {
    try {
        const currentTime = new Date().toLocaleString();
        const successMessage = `${currentTime} - Source: ${source}\nError: ${error.stack}\n\n`;
        const logsDir = path.join(__dirname, 'logs');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir);
        }
        const logFilePath = path.join(logsDir, 'success.log');

        fs.appendFile(logFilePath, accessMessage, (err) => {
            if (err) {
                console.error('Ошибка записи в файл:', err);
            } else {
                console.log('Успех успешно записан в файл.');
            }
        });
    } catch (error) {
        console.error(error);
    }
}

module.exports = { logError, logAccess, logSuccess }