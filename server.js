const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');

// Настройка Express
const app = express();
const port = 3000;

// Создаем HTTP сервер
const server = http.createServer(app);

// Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });

// Путь к файлу с сообщениями
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Функция для загрузки сообщений из файла
async function loadMessages() {
    try {
        const data = await fs.readFile(MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // Если файл не существует, возвращаем пустой массив
        return [];
    }
}

// Функция для сохранения сообщений в файл
async function saveMessage(message) {
    try {
        const messages = await loadMessages();
        messages.push(message);
        await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages));
    } catch (err) {
        console.error('Ошибка при сохранении сообщения:', err);
    }
}

// Настройка статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Хранение активных подключений
const clients = new Set();

// Обработка WebSocket подключений
wss.on('connection', async (ws) => {
    console.log('Новое подключение к WebSocket');
    clients.add(ws);
    
    try {
        // Загружаем и отправляем историю сообщений
        const messages = await loadMessages();
        ws.send(JSON.stringify({
            type: 'history',
            messages: messages
        }));
    } catch (err) {
        console.error('Ошибка при загрузке истории:', err);
    }
    
    ws.on('message', async (data) => {
        try {
            const messageData = JSON.parse(data);
            
            // Создаем объект сообщения
            const message = {
                username: messageData.username,
                message: messageData.message,
                timestamp: new Date().toISOString()
            };
            
            // Сохраняем сообщение в файл
            await saveMessage(message);
            
            // Отправляем сообщение всем клиентам
            const broadcastMessage = JSON.stringify({
                type: 'message',
                message: message
            });
            
            clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(broadcastMessage);
                }
            });
        } catch (err) {
            console.error('Ошибка при обработке сообщения:', err);
        }
    });

    ws.on('close', () => {
        console.log('Клиент отключился');
        clients.delete(ws);
    });
});

// Запуск сервера
server.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});