const express = require('express')
const multer = require('multer')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { PASSWORD, JWT_KEY } = require('../config')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const Services = require('../models/services')
const Booking = require('../models/booking')
const oldAuth = require('../middleware/auth')

router = express.Router()

const auth = (req, res, next) => {
    const bearerHead = req.headers['authorization']
    if (typeof bearerHead !== undefined && bearerHead) {
        const token = bearerHead.split(' ')[1]
        jwt.verify(token, JWT_KEY, (err, authData) => {
            if (err) res.sendStatus(400)
            else {
                const data = authData
                if (data.user === "Admin") {
                    next()
                } else {
                    res.sendStatus(403)
                }
            }
        })
    } else {
        res.sendStatus(403)
    }
}

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

router.post('/uploadLogo', auth, async (req, res) => {
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

router.get('/hospitalList', (req, res) => {
    console.log("Get hospitals")
    User.find({ userType: "Hospital" }).distinct('name', (err, hospitalList) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send(hospitalList)
        }
    })
})

router.get('/paymentCount', auth, (req, res) => {
    console.log("Get pages count")
    Booking.aggregate([
        {
            $match: {
                redeemStatus: { $in: ['Requested', 'Rejected', 'Processed'] }
            }
        },
        {
            $addFields: {
                "serviceId": { "$toObjectId": "$serviceId" },
                "userId": { "$toObjectId": "$userId" },
                "professionalId": { "$toObjectId": "$professionalId" }
            }
        },
        {
            $lookup: {
                "from": Services.collection.name,
                "localField": "serviceId",
                "foreignField": "serviceId",
                "as": "serviceDetails"
            }
        },
        {
            $lookup: {
                "from": User.collection.name,
                "localField": "professionalId",
                "foreignField": "_id",
                "as": "professionalDetails"
            }
        },
        {
            $lookup: {
                "from": User.collection.name,
                "localField": "userId",
                "foreignField": "_id",
                "as": "userDetails"
            }
        },
        {
            $unwind: "$serviceDetails"
        },
        {
            $unwind: "$userDetails"
        },
        {
            $unwind: "$professionalDetails"
        },
        {
            $count: "count"
        }
    ], (err, docs) => {
        if (err) {
            console.log("Error", err)
            res.status(400).send({
                status: 0,
                data: err,
                msg: ''
            })
        } else {
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

router.get('/payments/:page', auth, (req, res) => {
    console.log("Get payments", req.params.page)
    const skip = req.params.page - 1
    Booking.aggregate([
        {
            $match: {
                redeemStatus: { $in: ['Requested', 'Rejected', 'Processed'] }
            }
        },
        {
            $sort: {
                _id: -1
            }
        },
        {
            $addFields: {
                "serviceId": { "$toObjectId": "$serviceId" },
                "userId": { "$toObjectId": "$userId" },
                "professionalId": { "$toObjectId": "$professionalId" }
            }
        },
        {
            $lookup: {
                "from": Services.collection.name,
                "localField": "serviceId",
                "foreignField": "serviceId",
                "as": "serviceDetails"
            }
        },
        {
            $lookup: {
                "from": User.collection.name,
                "localField": "professionalId",
                "foreignField": "_id",
                "as": "professionalDetails"
            }
        },
        {
            $lookup: {
                "from": User.collection.name,
                "localField": "userId",
                "foreignField": "_id",
                "as": "userDetails"
            }
        },
        {
            $unwind: "$serviceDetails"
        },
        {
            $unwind: "$userDetails"
        },
        {
            $unwind: "$professionalDetails"
        },
        {
            $addFields: {
                "serviceName": "$serviceDetails.service",
                "specialityName": "$serviceDetails.speciality",
                "bookingStatus": "$bookingDetails.bookingStatus",
                "timeSlot": "$serviceDetails.timeSlot"
            }
        },
        {
            $skip: skip * 100
        },
        {
            $limit: 100
        }
    ], (err, docs) => {
        if (err) {
            console.log("Error", err)
            res.status(400).send({
                status: 0,
                data: err,
                msg: ''
            })
        } else {
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

router.patch('/paymentStatus', (req, res) => {
    console.log("Update payment status")
    Booking.updateOne({ _id: req.body.bookingId }, { $set: { redeemStatus: req.body.bookingStatus } }, (err, docs) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send(docs)
        }
    })
})

router.patch('/updatePrice', oldAuth, async (req, res) => {
    console.log("Update price", req.body.newPrice, typeof req.body.newPrice)
    await asyncForEach(req.user.specialities, async element => {
        if (element.specialityId === req.body.specialityId) {
            await asyncForEach(element.services, async subElement => {
                if (subElement.serviceId === req.body.serviceId) {
                    subElement.price = [req.body.newPrice]
                }
            })
        }
    })
    req.user.save().then(docs => {
        console.log("Saved User")
        res.status(200).send({
            status: 1,
            data: docs,
            msg: ''
        })
    })
        .catch(e => {
            console.log(e)
            res.status(400).send({
                status: 0,
                data: e,
                msg: ''
            })
        })
})

router.patch('/updatePriceVariance', auth, async (req, res) => {
    console.log("Update price/variance", req.body.newPrice, req.body.newVariance)
    req.user = await User.findOne({ _id: mongoose.Types.ObjectId(req.body.userId) })
    await asyncForEach(req.user.specialities, async element => {
        if (element.specialityId === req.body.specialityId) {
            await asyncForEach(element.services, async subElement => {
                if (subElement.serviceId === req.body.serviceId) {
                    subElement.price = [req.body.newPrice]
                    if (req.body.newVariance) {
                        subElement.variance = req.body.newVariance
                    }
                }
            })
        }
    })
    req.user.save().then(docs => {
        console.log("Saved User")
        res.status(200).send({
            status: 1,
            data: docs,
            msg: ''
        })
    })
        .catch(e => {
            console.log(e)
            res.status(400).send({
                status: 0,
                data: e,
                msg: ''
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

router.post('/getDoctorInfo', (req, res) => {
    console.log("Get doctor info", req.body)
    User.findOne({ name: req.body.hospitalName, 'doctors.name': req.body.doctorName }, 'doctors', (err, doctorRecord) => {
        if (err) res.status(400).send(err)
        else if (doctorRecord) {
            let tempObj = {}
            doctorRecord.doctors.forEach(async element => {
                if (element.name === req.body.doctorName) {
                    tempObj = element
                    console.log(element.specialities[0].specialityId, element.specialities[0].services[0].serviceId)
                    tempObj.speciality = await getSpecialityName(element.specialities[0].specialityId)
                    tempObj.service = await getServiceName(element.specialities[0].services[0].serviceId)
                }
            })
            res.status(200).send(tempObj)
        } else {
            res.status(200).send()
        }
    })
})

router.patch('/deleteDoctor', (req, res) => {
    console.log("Delete doctor", req.body.id)
    User.updateOne({ "doctors._id": mongoose.Types.ObjectId(req.body.id) }, { $pull: { doctors: { _id: mongoose.Types.ObjectId(req.body.id) } } }, (err, updated) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send(updated)
        }
    })
})

router.patch('/addHospitalDoctor', async (req, res) => {
    console.log("Add doctor to hospital", req.body)
    if (req.body.doctorId) {
        console.log("Update doctor")
        try {
            let hospitalRecord = await User.findOne({ userType: "Hospital", name: req.body.hospitalName })
            hospitalRecord.doctors.forEach(element => {
                if (element._id.toString() === req.body.doctorId) {
                    element.name = req.body.name
                    element.education = req.body.education
                    element.designation = req.body.designation
                    element.department = req.body.department
                    element.experience = req.body.experience
                    req.body.price ?
                        (element.specialities[0].services[0] ?
                            element.specialities[0].services[0].price = [parseInt(req.body.price)] :
                            element.specialities[0].services = [{ price: [parseInt(req.body.price)] }]) : null
                    req.body.variance ?
                        (element.specialities[0].services[0] ?
                            element.specialities[0].services[0].variance = [parseInt(req.body.variance)] :
                            element.specialities[0].services = [{ price: [parseInt(req.body.price)], variance: parseInt(req.body.variance) }]) : null
                }
            })
            hospitalRecord.save().then(docs => {
                res.status(200).send(docs)
            }).catch(err => {
                res.status(400).send(err)
            })
        } catch (e) {
            console.log(e)
            res.status(400).send(e)
        }
    } else {
        console.log("Add new doctor")
        User.updateOne({ userType: "Hospital", name: req.body.hospitalName }, {
            $addToSet: { doctors: req.body }
        }, (err, docs) => {
            if (err) res.status(400).send(err)
            else {
                res.status(200).send(docs)
            }
        })
    }
})

router.get('/specialityConsultation/:speciality', (req, res) => {
    console.log("Get consultations", req.params.speciality)
    Services.find({ speciality: req.params.speciality, category: "Consultation" }, 'service serviceId specialityId').lean().exec((err, consultation) => {
        if (err) res.status(400).send(err)
        else {
            res.status(200).send(consultation)
        }
    })
})

router.post('/addSpeciality', auth, (req, res) => {
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

router.put('/updateSpecialityName', auth, (req, res) => {
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

router.post('/addService', auth, (req, res) => {
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

router.post('/serviceData', auth, (req, res) => {
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

router.put('/modifyService', auth, (req, res) => {
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

router.post('/getServices', auth, (req, res) => {
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

router.post('/addHospital', auth, (req, res) => {
    console.log("Add Hospital")
    const newHospital = new User({
        ...req.body
    })
    newHospital.save().then(docs => {
        res.status(201).send({
            status: 1,
            data: [],
            msg: "Success"
        })
    }).catch(e => {
        res.status(400).send(e)
        console.log(e)
    })
})

router.get('/getHospitals', auth, (req, res) => {
    User.find({ userType: 'Hospital' }, 'name email mobileNumber address specialities registrationNumber experience').lean().exec(async (err, docs) => {
        if (err) res.status(400).send(err)
        else {
            await asyncForEach(docs, async (rootElement, index) => {
                let specialities = ''
                if (rootElement.specialities) {
                    await asyncForEach(rootElement.specialities, async element => {
                        let specialityName = await getSpecialityName(element.specialityId)
                        if (specialityName) {
                            specialities = specialities ? specialities + ", " + specialityName : specialityName
                        }
                    })
                }
                docs[index]["specialityList"] = specialities
            })
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

router.get('/getDoctors', auth, (req, res) => {
    User.find({ userType: 'Doctor' }, 'name email mobileNumber address specialities registrationNumber experience').lean().exec(async (err, docs) => {
        if (err) res.status(400).send(err)
        else {
            await asyncForEach(docs, async (rootElement, index) => {
                let specialities = ''
                if (rootElement.specialities) {
                    await asyncForEach(rootElement.specialities, async element => {
                        let specialityName = await getSpecialityName(element.specialityId)
                        if (specialityName) {
                            specialities = specialities ? specialities + ", " + specialityName : specialityName
                        }
                    })
                }
                docs[index]["specialityList"] = specialities
            })
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const getSpecialityName = id => {
    return new Promise((resolve, reject) => {
        if (id) {
            if (typeof a !== 'object') id = mongoose.Types.ObjectId(id)
            Services.findOne({ specialityId: id }, 'speciality', (err, specialityName) => {
                if (err) reject(err)
                else if (specialityName) resolve(specialityName.speciality)
                else resolve('')
            })
        } else resolve('')
    })
}

const getServiceName = id => {
    return new Promise((resolve, reject) => {
        if (id) {
            if (typeof a !== 'object') id = mongoose.Types.ObjectId(id)
            Services.findOne({ serviceId: id }, 'service', (err, serviceName) => {
                if (err) reject(err)
                else if (serviceName) resolve(serviceName.service)
                else resolve(id)
            })
        } else {
            resolve('')
        }
    })
}

router.get('/getUser/:id', auth, (req, res) => {
    console.log("Get user", req.params.id)
    User.findOne({ _id: mongoose.Types.ObjectId(req.params.id) }, '-password -deviceIds -userType -verifiedUser -imageUrl -achievements -workTimings -creditsEarned').lean().exec(async (err, docs) => {
        if (err) res.status(400).send(err)
        else {
            await asyncForEach(docs.specialities, async element => {
                element.speciality = await getSpecialityName(element.specialityId)
                await asyncForEach(element.services, async subElement => {
                    subElement.service = await getServiceName(subElement.serviceId)
                })
            })
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

router.post("/updateUser", auth, (req, res) => {
    const userId = mongoose.Types.ObjectId(req.body.id)
    const updateValues = req.body
    console.log("Update user", updateValues)
    User.updateOne({ _id: userId }, { $set: updateValues }, (err, updateUser) => {
        if (err) res.status(400).send(err)
        else res.status(200).send(updateUser)
    })
})

module.exports = router