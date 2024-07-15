const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require("path");
const timeout = require("connect-timeout");
const {logError} = require("./logger/logger");
const {addBxLink, getBxCredentials, setConnection, checkIfExists, addContactsToDb, addCompaniesToDb, addDealsToDb, setSummary, getLastDealDateFromSummary, getFromDb, getMaxId, markOnCall} = require("./services/db.js");

const {CompaniesService} = require("./services/companies");
const {DealsService} = require("./services/deals");

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const PORT = 4000;
const app = express();

const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

const key = process.env.ENCRYPTION_KEY;

app.use(cors({
    origin: "https://cdn-ru.bitrix24.ru",
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true, // Устанавливаем true для использования HTTPS
        sameSite: 'None' // Замените на 'Lax' или 'None' в зависимости от совместимости браузера
    }
}));

app.use((req, res, next) => {
    setConnection(connection);
    next();
});

app.use(timeout('10m'));

function haltOnTimedOut(req, res, next) {
    if (!req.timedout) next();
}

app.post("/gradation/init", async (req, res) => {
    try {
        const raw = req.body;
        if (!raw.bx && !raw.link) {
            res.status(400).json({"status": "error", "message": "Отсутствует название системы!"});
            return;
        }
        if (await checkIfExists(raw.bx)) {
            const credentials = await getBxCredentials(raw.bx, key);
            req.session.link = credentials.link; // Сохраняем ссылку в сессии
            req.session.bx = credentials.bx;
            res.status(200).json({"status": "success", "message": "Ссылка на битрикс успешно получена!", "link": credentials.link});
        } else {
            res.status(401).json({"status": "error", "message": "Данный битрикс отсутствует в системе, пожалуйста, пройдите авторизацию!"});
        }
    } catch (error) {
        logError("/init", error);
        res.status(500).json({"status": "error", "message": "Что то пошло не так"})
    }
})

app.post("/gradation/add_bx", async (req, res) => {
    try {
        const raw = req.body;
        if (!raw.bx && !raw.link) {
            res.status(400).json({"status": "error", "message": "Отсутствует название системы или ссылка для входящего вебхука!"});
            return;
        }
        if (await checkIfExists(raw.bx)) {
            res.status(409).json({"status": "error", "message": "Данный битрикс уже существует!"});
        } else {
            if(await addBxLink(raw.bx, raw.link, key)) {
                res.status(200).json({ "status": "success", "message": "Битрикс успешно добавлен в систему!" })
            } else {
                res.status(500).json({ "status": "error", "message": "Произошла какая-то ошибка..." })
            }
        }
    } catch (error) {
        logError("/add_bx", error);
        res.status(500).json({"status": "error", "message": "Что то пошло не так"})
    }
})

app.post("/gradation/set_and_return_current_data", async (req, res) => {
    try {
        const raw = req.body;

        let link = "";
        let bx = "";
        if (!raw.bx && !raw.link) {
            res.status(400).json({ "status": "error", "message": "Отсутствует название системы!" });
            return;
        }
        if (await checkIfExists(raw.bx)) {
            const credentials = await getBxCredentials(raw.bx, key);
            link = credentials.link; // Сохраняем ссылку в сессии
            bx = credentials.bx;
        } else {
            res.status(401).json({ "status": "error", "message": "Данный битрикс отсутствует в системе, пожалуйста, пройдите авторизацию!" });
        }
        if (link) {
            const companiesService = new CompaniesService(link);
            const dealsService = new DealsService(link);

            const maxCompanyId = await getMaxId( "companies") || 0;
            const newCompanies = await companiesService.getCompaniesFromId(maxCompanyId);
            await addCompaniesToDb(newCompanies);

            const maxDealId = await getMaxId( "deals") || 0;
            const newDeals = await dealsService.fetchDealsById(maxDealId);
            await addDealsToDb(newDeals);

            await setSummary();

            const allCompanies = await getFromDb( "companies");
            const allDeals = await getFromDb( "deals");

            res.status(200).json({ "status": "success", "total": { "companies": allCompanies.length, "deals": allDeals.length }, "companies": allCompanies, "deals": allDeals });
        } else {
            res.status(401).json({ "status": "error", "message": "Пожалуйста, сначала пройдите инициализацию" });
        }
    } catch (error) {
        logError("/set_and_return_current_data", error);
        res.status(500).json({ "status": "error", "message": "Что-то пошло не так" });
    }
}, haltOnTimedOut);

app.post("/gradation/mark_on_call", async (req, res) => {
    try {
        const raw = req.body;

        let link = "";
        let bx = "";
        if (!raw.bx && !raw.link) {
            res.status(400).json({ "status": "error", "message": "Отсутствует название системы!" });
            return;
        }
        if (await checkIfExists(raw.bx)) {
            const credentials = await getBxCredentials(raw.bx, key);
            link = credentials.link; // Сохраняем ссылку в сессии
            bx = credentials.bx;
        } else {
            res.status(401).json({ "status": "error", "message": "Данный битрикс отсутствует в системе, пожалуйста, пройдите авторизацию!" });
        }

        const companies = raw.companies || null;

        if (link) {
            if (companies) {
                await markOnCall( companies, "companies");
                res.status(200).json({"status": "success", "message": "Выбранные компании успешно отмечены!"});
            } else {
                res.status(400).json({"status": "error", "message": "Не выбрана ни одна компания/клиент"});
            }
        } else {
            res.status(401).json({ "status": "error", "message": "Пожалуйста, сначала пройдите инициализацию" });
        }
    } catch (error) {
        logError("/gradation/mark_on_call", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"});
    }
})

app.listen(PORT, () => {
    connection.connect((err) => {
        if (err) {
            logError("DB CONNECTION", err);
        } else {
            console.log("Подключение в базе данных успешно установленно")
        }
    })
    console.log(`Сервер запущен на порту ${PORT}`);
});