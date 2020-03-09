const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')
const path = require('path')
const jwt = require('jsonwebtoken')
const { PASSWORD, JWT_KEY } = require('../config')
const multer = require('multer')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const Services = require('../models/services')

router = express.Router()

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
}).single('file')

router.post('/uploadLogo', async (req, res) => {
    console.log("Upload")
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        console.log("Filename", req.file.filename)
        return res.status(200).send({
            status: 1,
            data: req.file,
            msg: "success"
        })
    })
})


router.post('/login', (req, res) => {
    console.log("Login")
    if (req.body.password === PASSWORD) {
        console.log("Authenticated User")
        jwt.sign({ user: "Admin" }, JWT_KEY, (err, token) => {
            if (err) res.status(403).send()
            res.json({ token })
        })
    } else {
        console.log("User not authenticated", req.body.password)
        res.status(403).send()
    }
})

router.get('/specialities', (req, res) => {
    console.log("Get specialities")
    Catalogue.distinct('speciality').exec((err, specialities) => {
        if (err) {
            console.log(err)
            res.status(400).send(err)
        } else {
            res.status(200).send({
                status: 1,
                data: specialities,
                msg: ''
            })
        }
    })
})

router.post('/addSpeciality', (req, res) => {
    console.log("Add speciality", req.body.specialityName)
    Catalogue.findOne({ speciality: req.body.specialityName }, (err, docs) => {
        if (err) res.status(400).send(err)
        else if (docs) {
            res.status(200).send({
                status: 0,
                data: [],
                msg: 'Speciality already exists'
            })
        } else {
            let newSpeciality = new Catalogue({
                speciality: req.body.specialityName,
                services: []
            })
            newSpeciality.save().then(docs => {
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: `Speciality "${req.body.specialityName}" created`
                })
            })
        }
    })
})

router.put('/updateSpecialityName', (req, res) => {
    console.log("Update speciality name", req.body.oldName, req.body.newName)
    Catalogue.updateOne({ speciality: req.body.oldName }, { $set: { speciality: req.body.newName } }, (err, updateDocs) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send({
                status: 1,
                data: updateDocs,
                msg: `Speciality name changed to "${req.body.newName}"`
            })
        }
    })
})

router.post('/addService', (req, res) => {
    console.log("Add service", req.body)
    const newService = {
        service: req.body.service,
        details: req.body.details,
        dnd: req.body.dnd,
        tags: req.body.tags,
        category: req.body.category
    }
    Catalogue.updateOne({ speciality: req.body.speciality }, { $push: { services: newService } }, (err, updateSpeciality) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send({
                status: 1,
                data: updateSpeciality,
                msg: `Service added changed to "${req.body.speciality}"`
            })
        }
    })
})

router.post('/serviceData', (req, res) => {
    console.log("Get service data", req.body.speciality, req.body.serviceName)
    Catalogue.aggregate([
        { $match: { 'speciality': req.body.speciality, 'services.service': req.body.serviceName } },
        {
            $project: {
                service: {
                    $filter: {
                        input: '$services',
                        as: 'services',
                        cond: { $eq: ['$$services.service', req.body.serviceName] }
                    }
                },
                _id: 0
            }
        }
    ], (err, serviceData) => {
        if (err) res.status(400).send(err)
        else if (serviceData.length > 0) {
            console.log({ serviceData })
            res.status(200).send({
                status: 1,
                data: serviceData[0].service[0],
                msg: ``
            })
        } else {
            res.status(200).send({
                status: 0,
                data: [],
                msg: `Service ${req.body.serviceName} not found`
            })
        }
    })
})

router.put('/modifyService', (req, res) => {
    console.log("Edit service", req.body)
    Catalogue.updateOne(
        { speciality: req.body.speciality, "services.service": req.body.service },
        {
            $set:
            {
                "services.$.tags": req.body.tags,
                "services.$.dnd": req.body.dnd,
                "services.$.details": req.body.details,
                "services.$.category": req.body.category,
                "services.$.tags": req.body.tags
            }
        }
        , (err, docs) => {
            if (err) res.status(400).send(err)
            else {
                res.status(200).send({
                    status: 1,
                    data: docs,
                    msg: `Service "${req.body.service}" updated`
                })
            }
        })
})

router.post('/getServices', (req, res) => {
    console.log("Get services for", req.body.speciality)
    Catalogue.findOne({ speciality: req.body.speciality }, 'services').lean().exec((err, serviceDocs) => {
        if (err) res.status(400).send(err)
        else {
            serviceDocs.services.forEach(element => {
                element._id = element._id.toString()
                element._id = element._id.slice(element._id.length - 5, element._id.length)
            });
            res.status(200).send({
                status: 1,
                data: serviceDocs,
                msg: ''
            })
        }
    })
})

router.post('/addHospital', (req, res) => {
    console.log("Add Hospital")
    const newHospital = new User({
        ...req.body, userType: "Hospital"
    })
    newHospital.save().then(docs => {
        res.status(201).send({
            status: 1,
            data: [],
            msg: "Success"
        })
    }).catch(e => {
        res.status(400).send(e)
    })
})

module.exports = router