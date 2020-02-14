require('log-timestamp')
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const mongoose = require('mongoose')
const fs = require('fs')
const multer = require('multer')
const {
    execFileSync
} = require('child_process')

const Config = require('./config')

const user = require('./routes/user')
const catalogue = require('./routes/catalogue')
const catalogue_manager = require('./routes/catalogue_manager')
const enquiry = require('./routes/enquiry')
const solution = require('./routes/solution')
const booking = require('./routes/booking')
const notification = require('./routes/notification')
const payment = require('./routes/payment')
const load = require('./routes/load')
const report = require('./routes/report')
const analytics = require('./routes/analytics')
const prescription = require('./routes/prescription')
const app = express()

app.use(express.json({
    limit: '50mb',
    extended: true
}))
app.use(express.urlencoded({
    limit: '50mb',
    extended: true
}))
app.use(cors())
app.use(morgan('dev'))

app.use('/user', user)
app.use('/catalogue', catalogue)
app.use('/catalogue_manager', catalogue_manager)
app.use('/enquiry', enquiry)
app.use('/solution', solution)
app.use('/booking', booking)
app.use('/notification', notification)
app.use('/payment', payment)
app.use('/load', load)
app.use('/report', report)
app.use('/analytics', analytics)
app.use('/prescription', prescription)
app.use('/data', express.static('data'))
app.use('/public', express.static('public'))

mongoose.connect(Config.MONGODB_URL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
}, () => console.log("MongoDB connected to", Config.MONGODB_URL))

app.get('/', (req, res) => res.send('Plunes Backend 2.0'))

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public')
    },
    filename: function (req, file, cb) {
        file.originalname = file.originalname.split('.')[0] + (file.originalname.split('.')[1] ? "." + file.originalname.split('.')[1].toLowerCase() : '')
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({
    storage: storage
}).array('file', 10)

app.post('/upload', function (req, res) {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        let result = "You have uploaded these images: <hr />";
        const files = req.files;
        let index, len;

        // Loop through all the uploaded images and display them on frontend
        for (index = 0, len = files.length; index < len; ++index) {
            result += `<img src="${files[index].path}" width="300" style="margin-right: 20px;">`;
        }
        console.log(result)
        req.file.filename = req.file.filename.split('.')[0] + (req.file.filename.split('.')[1] ? "." + req.file.filename.split('.')[1].toLowerCase() : '')
        if (req.file.filename.endsWith('.pdf')) {
            console.log(execFileSync('/usr/bin/convert', ['./public/' + req.file.filename + '[0]', './public/' + req.file.filename + '.thumbnail.png']).toString('utf8'))
        } else if (req.file.filename.endsWith('.jpg') || req.file.filename.endsWith('.jpeg') || req.file.filename.endsWith('.png')) {
            console.log(execFileSync('/usr/bin/convert', ['./public/' + req.file.filename, '-resize', '260x168', './public/' + req.file.filename + '.thumbnail.png']).toString('utf8'))
        }
        return res.status(200).send(req.file)
    })
})

app.get('/installer/:id', (req, res) => {
    const data = "BASE_URL = https://plunes.co/v4\nFILE_UPLOAD_URL = https://plunes.co/v4/upload\nREPORT_UPLOAD_URL = https://plunes.co/v4/report/upload\nUSER_ID = " + req.params.id
    const filename = 'Plockr-' + Date.now() + '.zip'
    fs.writeFileSync('./Plockr/.env', data)
    execFileSync('/usr/bin/zip', ['-r', './public/' + filename, './Plockr'])
    res.status(201).send({
        success: true,
        downloadUrl: 'https://plunes.co/v4/public/' + filename
    })
})

const server = app.listen(Config.PORT, () => {
    console.log(`server running on port ${Config.PORT}`)
})

server.timeout = 600000