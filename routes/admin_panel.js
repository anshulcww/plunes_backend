const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')
const path = require('path')
const jwt = require('jsonwebtoken')
const { PASSWORD, JWT_KEY } = require('../config')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const Services = require('../models/services')

router = express.Router()

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

router.get('/serviceData/:speciality/:serviceName', (req, res) => {
    console.log("Get service data", req.params.speciality, req.params.serviceName)
    Catalogue.aggregate([
        { $match: { 'speciality': req.params.speciality, 'services.service': req.params.serviceName } },
        {
            $project: {
                service: {
                    $filter: {
                        input: '$services',
                        as: 'services',
                        cond: { $eq: ['$$services.service', req.params.serviceName] }
                    }
                },
                _id: 0
            }
        }
    ], (err, serviceData) => {
        if (err) res.status(400).send(err)
        else if (serviceData) {
            res.status(200).send({
                status: 1,
                data: serviceData.service[0],
                msg: ``
            })
        } else {
            res.status(200).send({
                status: 0,
                data: [],
                msg: `Service ${req.params.serviceName} not found`
            })
        }
    })
})

router.put('/modifySpeciality', (req, res) => {
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