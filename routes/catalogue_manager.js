const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')

const Catalogue = require('../models/catalogue')
const Services = require('../models/services')
const User = require('../models/user')

router = express.Router()

const storageHospital = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public')
    },
    filename: function (req, file, cb) {
        file.originalname = file.originalname.split('.')[0] + (file.originalname.split('.')[1] ? "." + file.originalname.split('.')[1].toLowerCase() : '')
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const storageCatalog = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public')
    },
    filename: function (req, file, cb) {
        file.originalname = file.originalname.split('.')[0] + (file.originalname.split('.')[1] ? "." + file.originalname.split('.')[1].toLowerCase() : '')
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const uploadHospital = multer({
    storage: storageHospital
}).single('file')

const uploadCatalog = multer({
    storage: storageCatalog
}).single('file')

app.post('/upload', function (req, res) {
    console.log("Upload", req.body.type, req.file.filename)
    if (req.filename.filename.split(".")[1] && req.filename.filename.split(".")[1].toLowerCase() === 'xlsx') {
        req.file.filename = req.file.filename.split('.')[0] + "." + req.file.filename.split('.')[1].toLowerCase()
        if (req.body.type === "hospital") {
            uploadHospital(req, res, function (err) {
                if (err instanceof multer.MulterError) {
                    return res.status(500).json(err)
                } else if (err) {
                    return res.status(500).json(err)
                }
                console.log("FILENAME", req.file.filename)
                req.file.filename = req.file.filename.split('.')[0] + (req.file.filename.split('.')[1] ? "." + req.file.filename.split('.')[1].toLowerCase() : '')
                console.log("NEW FILENAME", req.file.filename)

                return res.status(200).send(req.file)
            })
        } else if (req.body.type === "catalog") {
            uploadCatalog(req, res, function (err) {
                if (err instanceof multer.MulterError) {
                    return res.status(500).json(err)
                } else if (err) {
                    return res.status(500).json(err)
                }
                console.log("FILENAME", req.file.filename)
                req.file.filename = req.file.filename.split('.')[0] + (req.file.filename.split('.')[1] ? "." + req.file.filename.split('.')[1].toLowerCase() : '')
                console.log("NEW FILENAME", req.file.filename)
                if (req.file.filename.endsWith('.pdf')) {
                    console.log(execFileSync('/usr/bin/convert', ['./public/' + req.file.filename + '[0]', './public/' + req.file.filename + '.thumbnail.png']).toString('utf8'))
                } else if (req.file.filename.endsWith('.jpg') || req.file.filename.endsWith('.jpeg') || req.file.filename.endsWith('.png')) {
                    console.log(execFileSync('/usr/bin/convert', ['./public/' + req.file.filename, '-resize', '260x168', './public/' + req.file.filename + '.thumbnail.png']).toString('utf8'))
                }
                return res.status(200).send(req.file)
            })
        }
    } else {
        res.status(400).send("Please upload valid xlsx file")
    }
})

module.exports = router