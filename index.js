const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require("path")
const {logError} = require("./logger/logger");
const {addBxLink, getBxCredentials, setConnection, checkIfExists, addContactsToDb, addCompaniesToDb, addDealsToDb, setSummary, getLastDealDateFromSummary, getFromDb, getMaxId} = require("./services/db.js");

const {ContactsService} = require("./services/contacts");
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
            req.session.bxId = credentials.bxId;
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

app.get("/gradation/write_all_contacts_to_db", async (req, res) => {
    try {
        const link = req.session.link || null;
        const bxId = req.session.bxId || null;
        if (link && bxId) {
            const contactsService = new ContactsService(link);
            const contacts = await contactsService.getAllClients();
            const result = await addContactsToDb(contacts, bxId);
            res.status(200).json({"status": "success", "affected rows": result.length, "contacts": contacts});
        } else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/get_all_contacts_data_write_to_db", error);
        res.status(500).json({"status": "error", "message": "Что то пошло не так"})
    }

})

app.get("/gradation/write_all_companies_to_db", async (req, res) => {
    try {
        const link = req.session.link || null;
        const bxId = req.session.bxId || null;
        if (link && bxId) {
            const companiesService = new CompaniesService(link);
            const companies = await companiesService.getAllCompanies();
            const result = await addCompaniesToDb(companies, bxId);
            res.status(200).json({"status": "success", "affected rows": result.length, "companies": companies});
        } else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/write_all_deals_to_db", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
    }
})

app.get("/gradation/write_all_deals_to_db", async (req, res) => {
    try {
        const link = req.session.link || null;
        const bxId = req.session.bxId || null;
        if (link && bxId) {
            const dealsService = new DealsService(link);
            const deals = await dealsService.fetchDealsByDate("2000-01-01");
            const result = await addDealsToDb(deals, bxId);
            res.status(200).json({"status": "success", "affected rows": result.length, "deals": deals});
        } else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/write_all_deals_to_db", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
    }
})

app.get("/gradation/write_deals_from_last_deal_date_to_db", async (req, res) => {
    try {
        const link = req.session.link || null;
        const bxId = req.session.bxId || null;
        if (link && bxId) {
            const dealsService = new DealsService(link);
            const lastDealDate = await getLastDealDateFromSummary(bxId);
            const deals = await dealsService.fetchDealsByDate(lastDealDate);
            const result = await addDealsToDb(deals, bxId);
            res.status(200).json({"status": "success", "affected rows": result?.length, "deals": deals});
        } else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/write_deals_from_last_deal_date_to_db", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
    }
})

app.get("/gradation/set_summary", async (req, res) => {
    try {
        const link = req.session.link || null;
        const bxId = req.session.bxId || null;
        if (link && bxId) {
            const result = await setSummary(bxId);
            if (result) {
                res.status(200).json({"status": "success", "message": "Данные успешно обновлены"});
            } else {
                res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
            }
        } else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/set_summary", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
    }
})

app.post("/gradation/set_and_return_current_data", async (req, res) => {
    try {
        const raw = req.body;

        let link = "";
        let bx = "";
        let bxId = "";
        if (!raw.bx && !raw.link) {
            res.status(400).json({"status": "error", "message": "Отсутствует название системы!"});
            return;
        }
        if (await checkIfExists(raw.bx)) {
            const credentials = await getBxCredentials(raw.bx, key);
            link = credentials.link; // Сохраняем ссылку в сессии
            bxId = credentials.bxId;
            bx = credentials.bx;
            res.status(200).json({"status": "success", "message": "Ссылка на битрикс успешно получена!", "link": credentials.link});
        } else {
            res.status(401).json({"status": "error", "message": "Данный битрикс отсутствует в системе, пожалуйста, пройдите авторизацию!"});
        }
        if (link && bxId) {
            const contactsService = new ContactsService(link);
            const companiesService = new CompaniesService(link);
            const dealsService = new DealsService(link);

            const maxContactId = await getMaxId(bxId, "contacts");
            const newContacts = await contactsService.getClientsFromId(maxContactId);
            await addContactsToDb(newContacts, bxId);

            const maxCompanyId = await getMaxId(bxId, "companies");
            const newCompanies = await companiesService.getCompaniesFromId(maxCompanyId);
            await addCompaniesToDb(newCompanies, bxId);

            const maxDealId = await getMaxId(bxId, "deals");
            const newDeals = await dealsService.fetchDealsById(maxDealId);
            await addDealsToDb(newDeals, bxId);

            await setSummary(bxId);

            const allClients = await getFromDb(bxId, "contacts");
            const allCompanies = await getFromDb(bxId, "companies");
            const allDeals = await getFromDb(bxId, "deals");

            res.status(200).json({"status": "success", "total": { "clients": allClients.length, "companies": allCompanies.length, "deals": allDeals.length }, "clients": allClients, "companies": allCompanies, "deals": allDeals});
        }  else {
            res.status(401).json({"status": "error", "message": "Пожалуйста, сначала пройдите инициализацию"})
        }
    } catch (error) {
        logError("/write_deals_from_last_deal_date_to_db", error);
        res.status(500).json({"status": "error", "message": "Что-то пошло не так"})
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