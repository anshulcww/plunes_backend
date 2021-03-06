const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')
const path = require('path')
const jwt = require('jsonwebtoken')
const { PASSWORD, JWT_KEY } = require('../config')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const Dictionary = require('../models/dictionary')

router = express.Router()

const verifyToken = (req, res, next) => {
    const bearerHead = req.headers['authorization']
    if (typeof bearerHead !== undefined) {
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

let globalObject = {}

var uploading = false

const loadDictionary = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await Dictionary.getCollection()
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

let dictionary = {}

loadDictionary().then(docs => {
    dictionary = docs
    console.log(dictionary)
}).catch(e => {
    console.log(e)
})

const getServiceId = (name, speciality) => {
    return new Promise(async (resolve, reject) => {
        try {
            Catalogue.aggregate([{
                $match: {
                    'services.service': name,
                    speciality: speciality
                }
            },
            {
                $project: {
                    serviceId: {
                        $filter: {
                            input: '$services',
                            as: 'services',
                            cond: {
                                $eq: ['$$services.service', name]
                            }
                        }
                    },
                    _id: 0
                }
            }
            ], (err, serviceIdDocs) => {
                if (err) console.log("Error", err)
                else {
                    resolve(serviceIdDocs[0] && serviceIdDocs[0].serviceId[0] ? serviceIdDocs[0].serviceId[0]._id.toString() : null)
                }
            })
        } catch (e) {
            reject(e)
        }
    })
}

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const storageHospital = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/hospitals')
    },
    filename: function (req, file, cb) {
        file.originalname = file.originalname.split('.')[0] + (file.originalname.split('.')[1] ? "." + file.originalname.split('.')[1].toLowerCase() : '')
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const storageCatalog = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/catalogs')
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

router.get('/getDictionary', verifyToken, (req, res) => {
    console.log("Get dictionary")
    Dictionary.getDictionary().then(docs => {
        res.status(200).send({
            status: 1,
            data: docs,
            msg: ''
        })
    }).catch(e => {
        res.status(400).send({
            status: 0,
            data: e,
            msg: 'error'
        })
    })
})

router.put('/addTag', verifyToken, async (req, res) => {
    console.log("Add to dictionary", req.body.keyword, req.body.tag)
    try {
        const tags = req.body.tag.replace(' ', '')
        const tagList = tags.split(',')
        await asyncForEach(tagList, async element => {
            await Dictionary.addTag(req.body.keyword, element)
        })
        console.log("Tags added")
        res.status(200).send()
    } catch (e) {
        console.log(err)
        res.status(400).send(err)
    }
})

router.put('/addKeyword', verifyToken, (req, res) => {
    console.log("Add to dictionary", req.body.keyword)
    Dictionary.addKeyword(req.body.keyword).then(docs => {
        console.log("Keyword added")
        res.status(200).send()
    }).catch(err => {
        console.log(err)
        res.status(400).send(err)
    })
})

router.delete('/removeTag/:tag', verifyToken, (req, res) => {
    console.log("Remove tag", req.params.tag)
    Dictionary.deleteTag(req.params.tag).then(docs => {
        console.log("Tag deleted")
        res.status(200).send()
    }).catch(err => {
        console.log(err)
        res.status(400).send(err)
    })
})

router.delete('/removeKeyword/:keyword', verifyToken, (req, res) => {
    console.log("Remove keyword", req.params.keyword)
    Dictionary.deleteKeyword(req.params.keyword).then(docs => {
        console.log("Keyword deleted")
        res.status(200).send()
    }).catch(err => {
        console.log(err)
        res.status(400).send(err)
    })
})

router.post('/uploadCatalog', verifyToken, async (req, res) => {
    console.log("Upload master catalog for speciality")
    uploadCatalog(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        console.log("Catalog Filename Before", req.file.filename)
        if (req.file.filename.split('.')[1] && req.file.filename.split('.')[1].toLowerCase() === 'xlsx') {
            req.file.filename = req.file.filename.split('.')[0] + "." + req.file.filename.split('.')[1].toLowerCase()
            console.log("Catalog Filename After", req.file.filename)
            await Catalogue.findOne({ speciality: req.body.speciality }, async (err, speciality) => {
                if (err) console.log(err)
                else if (!speciality) {
                    console.log("New speciality")
                    await new Catalogue({
                        speciality: req.body.speciality,
                        services: []
                    }).save()
                    console.log("Created new speciality", req.body.speciality)
                }
            })
            return res.status(200).send({
                status: 1,
                data: req.file,
                msg: "success"
            })
        } else {
            return res.status(400).send({
                status: 0,
                data: [],
                msg: "Please upload valid (*.xlsx) file"
            })
        }
    })
})

router.post('/uploadHospital', verifyToken, async (req, res) => {
    console.log("Upload hospital data")
    uploadHospital(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        if (req.file.filename.split('.')[1] && req.file.filename.split('.')[1].toLowerCase() === 'xlsx') {
            req.file.filename = req.file.filename.split('.')[0] + "." + req.file.filename.split('.')[1].toLowerCase()
            console.log("Hospital Filename", req.file.filename)
            return res.status(200).send({
                status: 1,
                data: req.file,
                msg: "success"
            })
        } else {
            return res.status(400).send({
                status: 0,
                data: [],
                msg: "Please upload valid (*.xlsx) file"
            })
        }
    })
})

router.post('/submit', verifyToken, async (req, res) => {
    console.log("Upload data submit", req.body.type, req.body.filename)
    if (!uploading) {
        if (req.body.type === 'Catalogue') {
            globalObject[req.body.filename] = {
                addedServices: [],
                namesUpdated: [],
                notFoundSpecialities: [],
                updatedServices: [],
                updatedServiceName: [],
                errors: [],
                replacedServiceNames: []
            }
            res.status(200).send({
                status: 1,
                data: [],
                msg: 'success'
            })
            try {
                uploading = true
                const result = await loadMasterSheet(req.body.filename, path.join(__dirname, '../public/catalogs/', req.body.filename))
                uploading = false
                fs.writeFile(path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                    if (err) console.log("Error writing log", err)
                    else {
                        delete globalObject[req.body.filename]
                        console.log("Written to log file", path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'))
                    }
                })
            } catch (e) {
                uploading = false
                console.log("Error uploading", e)
                res.status(400).send({
                    status: 0,
                    data: e,
                    msg: 'error'
                })
            }
        } else if (req.body.type === 'Hospital') {
            globalObject[req.body.filename] = {
                errors: [],
                notFoundSpecialities: [],
                notFoundServices: [],
                notFoundHospitals: [],
                updatedHospitals: []
            }
            try {
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: 'success'
                })
                try {
                    uploading = true
                    const result = await loadHospitalData(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
                    uploading = false
                    fs.writeFile(path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                        if (err) console.log("Error writing log", err)
                        else {
                            delete globalObject[req.body.filename]
                            console.log("Written to log file", path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'))
                        }
                    })
                } catch (e) {
                    uploading = false
                    console.log("Error", e)
                    res.status(400).send({
                        status: 0,
                        data: e,
                        msg: 'error'
                    })
                }
            } catch (e) {
                console.log("Error", e)
                res.status(400).send({
                    status: 0,
                    data: e,
                    msg: 'error'
                })
            }
        } else if (req.body.type === 'Speciality') {
            globalObject[req.body.filename] = {
                errors: [],
                notFoundSpecialities: [],
                notFoundServices: [],
                notFoundHospitals: [],
                updatedSpecialities: [],
                addedSpecialities: []
            }
            try {
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: 'success'
                })
                try {
                    uploading = true
                    const result = await loadSpecialityData(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
                    uploading = false
                    fs.writeFile(path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                        if (err) console.log("Error writing log", err)
                        else {
                            delete globalObject[req.body.filename]
                            console.log("Written to log file", path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'))
                        }
                    })
                } catch (e) {
                    console.log("Error", e)
                    uploading = false
                    res.status(400).send({
                        status: 0,
                        data: e,
                        msg: 'error'
                    })
                }
            } catch (e) {
                res.status(400).send({
                    status: 0,
                    data: e,
                    msg: 'error'
                })
            }
        } else if (req.body.type === 'Doctors') {
            globalObject[req.body.filename] = {
                notFoundSpecialities: [],
                errors: [],
                notFoundHospitals: [],
                updatedDoctors: [],
                addedDoctors: []
            }
            try {
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: 'success'
                })
                try {
                    uploading = true
                    const result = await loadDoctors(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
                    uploading = false
                    fs.writeFile(path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                        if (err) console.log("Error writing log", err)
                        else {
                            delete globalObject[req.body.filename]
                            console.log("Written to log file", path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'))
                        }
                    })
                } catch (e) {
                    uploading = false
                    console.log("Error", e)
                    res.status(400).send({
                        status: 0,
                        data: e,
                        msg: 'error'
                    })
                }
            } catch (e) {
                res.status(400).send({
                    status: 0,
                    data: e,
                    msg: 'error'
                })
            }
        } else if (req.body.type === 'Miscellaneous') {
            globalObject[req.body.filename] = {
                notFoundSpecialities: [],
                errors: [],
                notFoundHospitals: [],
                notFoundServices: [],
                addedSpecialities: [],
                addedServices: [],
                updatedHospitals: []
            }
            try {
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: 'success'
                })
                try {
                    uploading = true
                    const result = await loadMiscellaneousData(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
                    uploading = false
                    fs.writeFile(path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                        if (err) console.log("Error writing log", err)
                        else {
                            delete globalObject[req.body.filename]
                            console.log("Written to log file", path.join(__dirname, '../public/' + req.body.filename.split('.')[0] + '_upload_status.log'))
                        }
                    })
                } catch (e) {
                    uploading = false
                    console.log("Error", e)
                    res.status(400).send({
                        status: 0,
                        data: e,
                        msg: 'error'
                    })
                }
            } catch (e) {
                res.status(400).send({
                    status: 0,
                    data: e,
                    msg: 'error'
                })
            }
        }
    } else {
        console.log("Another upload in progress")
        res.status(400).send({
            status: 0,
            data: [],
            msg: "Another upload in progress"
        })
    }
})

router.get('/specialities', (req, res) => {
    console.log("Get speciality list")
    Catalogue.find({}, '_id speciality').exec((err, docs) => {
        if (err) {
            console.log(err)
            res.status(400).send({
                status: 0,
                data: err,
                msg: ''
            })
        }
        else {
            res.status(200).send({
                status: 1,
                data: docs,
                msg: ''
            })
        }
    })
})

router.get('/progress/:id', verifyToken, (req, res) => {
    if (globalObject[req.params.id]) {
        res.status(200).send({
            status: 1,
            data: globalObject[req.params.id],
            msg: "success"
        })
    } else {
        console.log("Reading from log file", req.params.id)
        uploading = false
        fs.readFile(path.join(__dirname, '../public/' + req.params.id.split('.')[0] + '_upload_status.log'), (err, data) => {
            if (err) {
                console.log("Error reading log file", err)
                res.status(200).send({
                    status: 1,
                    data: [],
                    msg: "no log file"
                })
            } else if (data) {
                res.status(200).send({
                    status: 2,
                    data: JSON.parse(data),
                    msg: "success"
                })
            } else {
                res.status(200).send({
                    status: 2,
                    data: [],
                    msg: "no log file"
                })
            }
        })
    }
})

const loadMasterSheet = (transactionId, f) => {
    return new Promise(async (resolve, reject) => {
        console.log("Upload master sheet", f)
        const data = xlsx.parse(fs.readFileSync(f))
        try {
            await asyncForEach(data.slice(0, 1), async sheet => {
                await asyncForEach(sheet.data.slice(1), async row => {
                    if (row.length > 0) {
                        // console.log({ row })
                        let speciality = row[0]
                        let service = row[1]
                        let updatedServiceName = row[2] === '' ? null : row[2]
                        let details = row[3]
                        let duration = row[4]
                        let sittings = row[5]
                        let dnd = row[6]
                        let tags = row[7]
                        let category = row[8]
                        let updated = row[9] === 'TRUE'
                        let deleted = row[10] === 'TRUE'

                        let catalogRecord = await Catalogue.findOne({
                            speciality
                        })

                        // Add/update service to DB
                        if (catalogRecord) {
                            let serviceTokens = service.split(' ')
                            let updatedServiceTokens = []

                            if (updatedServiceName) {
                                updatedServiceTokens = updatedServiceName.split(' ')
                            }

                            serviceTokens.forEach(element => {
                                if(dictionary[element]) {
                                    globalObject[transactionId].replacedServiceNames.push(`${service} - ${dictionary[element]}`)
                                    service.replace(element, dictionary[element])
                                }
                            })

                            updatedServiceTokens.forEach(element => {
                                if(dictionary[element]) {
                                    globalObject[transactionId].replacedServiceNames.push(`${service} - ${dictionary[element]}`)
                                    service.replace(element, dictionary[element])
                                }
                            })

                            let j
                            if (updatedServiceName) {
                                j = catalogRecord.services.findIndex(x => (x.service == updatedServiceName))
                                if (j !== -1) {
                                    console.log("Service name already updated", updatedServiceName)
                                    globalObject[transactionId].updatedServiceName.push(updatedServiceName)
                                }
                            } if (!j || j === -1) {
                                j = catalogRecord.services.findIndex(x => (x.service == service))
                            }
                            if (j === -1) {
                                console.log('Adding service:', service)
                                catalogRecord.services = catalogRecord.services.concat({
                                    service,
                                    details,
                                    duration: duration || 1,
                                    sittings: sittings || 1,
                                    dnd,
                                    tags,
                                    category
                                })
                                await catalogRecord.save()
                                globalObject[transactionId].addedServices.push(service)
                            }
                            else if (j !== -1) {
                                console.log(j)
                                if (updatedServiceName) {
                                    console.log("Updated name", updatedServiceName)
                                    catalogRecord.services[j].service = updatedServiceName
                                    globalObject[transactionId].namesUpdated.push(service + " -> " + updatedServiceName)
                                }
                                catalogRecord.services[j].details = details
                                catalogRecord.services[j].duration = duration
                                catalogRecord.services[j].sittings = sittings
                                catalogRecord.services[j].dnd = dnd
                                catalogRecord.services[j].tags = tags
                                catalogRecord.services[j].category = category
                                try {
                                    await catalogRecord.save()
                                    console.log("Updating record", service, j)
                                    globalObject[transactionId].updatedServices.push(updatedServiceName || service)
                                } catch (e) {
                                    globalObject[transactionId].errors.push(JSON.stringify(e.errmsg || e.message))
                                }
                            }
                        } else {
                            console.log('Speciality not found', speciality)
                            globalObject[transactionId].notFoundSpecialities.push(speciality)
                        }
                    }
                })
            })
            resolve()
        } catch (e) {
            reject(e)
        }
    })
}

// Iterate excel sheet for one hospital, creates array for 
// each speciality with services and replaces them in the user DB
const loadHospitalData = (transactionId, f) => {
    return new Promise(async (resolve, reject) => {
        console.log("Load hospital data", f)
        const data = xlsx.parse(fs.readFileSync(f))
        if (data) {
            try {
                const hospitalName = data[0].data[1][0]
                console.log("Hospital name:", hospitalName)
                let hospitalRecordMain = await User.findOne({
                    name: hospitalName
                })
                if (hospitalRecordMain) {
                    let specialitiesArray = []
                    await asyncForEach(data, async sheet => {
                        let tempObj = {
                            specialityId: '',
                            services: []
                        }
                        await asyncForEach(sheet.data.slice(1), async row => {
                            if (row.length > 0) {
                                let speciality = row[2]
                                const catalogueRecord = await Catalogue.findOne({
                                    speciality: speciality
                                })
                                if (catalogueRecord) {
                                    let specialityId = catalogueRecord._id.toString()
                                    let service = row[3]
                                    const serviceId = await getServiceId(service, speciality)
                                    if (serviceId) {
                                        // console.log(row[4], row[6])
                                        let variance = parseInt(row[4])
                                        let price = parseInt(row[6])
                                        let category = row[7]
                                        if ((variance || variance === 0) && (price || price === 0) && category) {
                                            tempObj.specialityId = tempObj.specialityId === '' ? specialityId : tempObj.specialityId
                                            tempObj.services = tempObj.services.concat({
                                                price: [price],
                                                category: category,
                                                serviceId: serviceId,
                                                variance: variance || 35,
                                                homeCollection: false
                                            })
                                        } else {
                                            console.log("Price/variance/category doesn't exist for", hospitalName, speciality, service)
                                            globalObject[transactionId].errors.push(`Price/variance/category doesn't exist for - ${hospitalName} : ${speciality} : ${service}`)
                                        }
                                    } else {
                                        console.log("Service doesn't exist in DB", service)
                                        globalObject[transactionId].notFoundServices.push(`${hospitalName} : ${speciality} : ${service}`)
                                    }
                                } else {
                                    console.log('Speciality not found', speciality)
                                    globalObject[transactionId].notFoundSpecialities.push(`${hospitalName} : ${speciality}`)
                                }
                            }
                        })
                        if (tempObj.services.length > 0) {
                            specialitiesArray.push(tempObj)
                        }
                    })
                    hospitalRecordMain.specialities = specialitiesArray
                    await hospitalRecordMain.save()
                    console.log("Updated", hospitalName)
                    globalObject[transactionId].updatedHospitals.push(hospitalName)
                    resolve()
                } else {
                    console.log("Hospital not in database", hospitalName)
                    globalObject[transactionId].notFoundHospitals.push(hospitalName)
                    reject("Hospital not in DB")
                }
            } catch (e) {
                reject(e)
            }
        } else {
            console.log("No data")
            reject()
        }
    })
}

// Iterate excel sheet for miscellaneous doctors for multiple specialities. 
// Super slow, one row at a time
const loadMiscellaneousData = (transactionId, f) => {
    return new Promise(async (resolve, reject) => {
        console.log("Load miscellaneous data", f)
        const data = xlsx.parse(fs.readFileSync(f))
        if (data) {
            try {
                let specialitiesArray = []
                await asyncForEach(data, async sheet => {
                    await asyncForEach(sheet.data.slice(1), async row => {
                        if (row.length > 0) {
                            const hospitalName = row[0]
                            console.log("Hospital name:", hospitalName)
                            let hospitalRecordMain = await User.findOne({
                                name: hospitalName
                            })
                            if (hospitalRecordMain) {
                                let speciality = row[2]
                                const catalogueRecord = await Catalogue.findOne({
                                    speciality: speciality
                                })
                                if (catalogueRecord) {
                                    let specialityId = catalogueRecord._id.toString()
                                    let service = row[3]
                                    const serviceId = await getServiceId(service, speciality)
                                    if (serviceId) {
                                        // console.log(row[4], row[6])
                                        let variance = parseInt(row[4])
                                        let price = parseInt(row[6])
                                        let category = row[7]
                                        if ((variance || variance === 0) && (price || price === 0) && category) {
                                            let specialityIndex = hospitalRecordMain.specialities.findIndex(element => element.specialityId === specialityId)
                                            if (specialityIndex !== -1) {
                                                console.log("Speciality already added to doctor, adding service")
                                                let serviceIndex = hospitalRecordMain.specialities[specialityIndex].services.findIndex(element => element.serviceId === serviceId)
                                                if (serviceIndex !== -1) {
                                                    console.log("Service already added to doctor")
                                                } else {
                                                    console.log("Adding service to doctor", `${hospitalName} : ${speciality} : ${service}`)
                                                    hospitalRecordMain.specialities[specialityIndex].services.push({
                                                        price: [price],
                                                        category: [category],
                                                        serviceId: serviceId,
                                                        variance: variance,
                                                        homeCollection: false
                                                    })
                                                    globalObject[transactionId].addedServices.push(`${hospitalName} : ${speciality} : ${service}`)
                                                }
                                            } else {
                                                console.log("Speciality not in doctor", speciality, hospitalName)
                                                hospitalRecordMain.specialities.push({
                                                    specialityId: specialityId,
                                                    services: []
                                                })
                                                globalObject[transactionId].addedSpecialities.push(`${hospitalName} : ${speciality}`)
                                            }
                                            await hospitalRecordMain.save()
                                            console.log("Updated", hospitalName)
                                            globalObject[transactionId].updatedHospitals.push(hospitalName)
                                        } else {
                                            console.log("Price/variance/category doesn't exist for", hospitalName, speciality, service)
                                            globalObject[transactionId].errors.push(`Price/variance/category doesn't exist for - ${hospitalName} : ${speciality} : ${service}`)
                                        }
                                    } else {
                                        console.log("Service doesn't exist in DB", service)
                                        globalObject[transactionId].notFoundServices.push(`${hospitalName} : ${speciality} : ${service}`)
                                    }
                                } else {
                                    console.log('Speciality not found', speciality)
                                    globalObject[transactionId].notFoundSpecialities.push(`${hospitalName} : ${speciality}`)
                                }
                            } else {
                                console.log("Hospital not in database", hospitalName)
                                globalObject[transactionId].notFoundHospitals.push(hospitalName)
                            }
                        }
                    })
                })
                resolve()
            } catch (e) {
                reject(e)
            }
        } else {
            console.log("No data")
            reject()
        }
    })
}

// Iterate excel sheet for one speciality, creates array for 
// each hospital and adds/updates them in DB
const loadSpecialityData = (transactionId, f) => {
    return new Promise(async (resolve, reject) => {
        console.log("Load speciality data", f)
        const data = xlsx.parse(fs.readFileSync(f))
        if (data) {
            try {
                await asyncForEach(data, async sheet => {
                    let tempObj = {
                        specialityId: '',
                        services: []
                    }
                    const hospitalName = sheet.data[1][0]
                    console.log("Hospital name:", hospitalName)
                    let hospitalRecordMain = await User.findOne({
                        name: hospitalName
                    })
                    if (hospitalRecordMain) {
                        let speciality
                        await asyncForEach(sheet.data.slice(1), async row => {
                            if (row.length > 0) {
                                speciality = row[2]
                                const catalogueRecord = await Catalogue.findOne({
                                    speciality: speciality
                                })
                                if (catalogueRecord) {
                                    let specialityId = catalogueRecord._id.toString()
                                    let service = row[3]
                                    const serviceId = await getServiceId(service, speciality)
                                    if (serviceId) {
                                        // console.log(row[4], row[6])
                                        let variance = parseInt(row[4])
                                        let price = parseInt(row[6])
                                        let category = row[7]
                                        if ((variance || variance === 0) && (price || price === 0) && category) {
                                            tempObj.specialityId = tempObj.specialityId === '' ? specialityId : tempObj.specialityId
                                            tempObj.services = tempObj.services.concat({
                                                price: [price],
                                                category: category,
                                                serviceId: serviceId,
                                                variance: variance || 35,
                                                homeCollection: false
                                            })
                                        } else {
                                            console.log("Price/variance/category doesn't exist for", hospitalName, speciality, service)
                                            globalObject[transactionId].errors.push(`Price/variance doesn't exist for - ${hospitalName} : ${speciality} : ${service}`)
                                        }
                                    } else {
                                        console.log("Service doesn't exist in DB", service)
                                        globalObject[transactionId].notFoundServices.push(`${hospitalName} : ${speciality} : ${service}`)
                                    }
                                } else {
                                    console.log('Speciality not found', speciality)
                                    globalObject[transactionId].notFoundSpecialities.push(`${hospitalName} : ${speciality}`)
                                }
                            }
                        })
                        let specialityIndex = hospitalRecordMain.specialities.findIndex(x => x.specialityId === tempObj.specialityId)
                        if (specialityIndex === -1) {
                            console.log("Speciality not in user")
                            globalObject[transactionId].addedSpecialities.push(`${hospitalName} : ${speciality}`)
                            hospitalRecordMain.specialities.push(tempObj)
                            await hospitalRecordMain.save()
                        } else {
                            hospitalRecordMain.specialities[specialityIndex].services = tempObj.services
                            globalObject[transactionId].updatedSpecialities.push(`${hospitalName} : ${speciality}`)
                            await hospitalRecordMain.save()
                        }
                    } else {
                        console.log("Hospital not in database", hospitalName)
                        globalObject[transactionId].notFoundHospitals.push(hospitalName)
                    }
                })
                resolve()
            } catch (e) {
                console.log("Error", e)
                reject(e)
            }
        } else {
            console.log("No data")
            reject()
        }
    })
}

const loadDoctors = (transactionId, f) => {
    return new Promise(async (resolve, reject) => {
        console.log("Load doctors", f)
        const data = xlsx.parse(fs.readFileSync(f))
        await asyncForEach(data, async sheet => {
            await asyncForEach(sheet.data.slice(1), async row => {
                // console.log({ row })
                let hospitalName = row[0]
                const hospitalRecord = await User.findOne({
                    name: hospitalName
                })
                if (hospitalRecord) {
                    let doctorName = row[1]
                    let speciality = row[2]
                    let education = row[3]
                    let consultationFee = row[4]
                    let experience = row[5]
                    let businessHours = row[6] | "10:00 AM-08:00 PM"
                    if (parseInt(experience) && parseInt(consultationFee)) {
                        let newDoctorRecord = {
                            name: doctorName,
                            education,
                            designation: "Doctor",
                            consultationFee: parseInt(consultationFee),
                            experience: parseInt(experience),
                            specialities: [],
                            timeSlots: [{
                                slots: [businessHours],
                                day: 'monday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'tuesday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'wednesday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'thursday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'friday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'saturday',
                                closed: false
                            },
                            {
                                slots: [businessHours],
                                day: 'sunday',
                                closed: true
                            }]
                        }
                        let catalogueRecord = await Catalogue.findOne({
                            speciality
                        })
                        if (catalogueRecord) {
                            let specialitiesRecord = {
                                specialityId: catalogueRecord._id
                            }
                            newDoctorRecord.specialities = specialitiesRecord
                            // console.log("New doctor record:", JSON.stringify(newDoctorRecord, undefined, 2))
                            let doctorExists = hospitalRecord.doctors.findIndex(x => x.name === doctorName)
                            if (doctorExists === -1) {
                                hospitalRecord.doctors.push(newDoctorRecord)
                                // console.log("Save new record", hospitalRecord)
                                await hospitalRecord.save()
                                globalObject[transactionId].addedDoctors.push(`${hospitalName} : ${doctorName}`)
                            } else {
                                console.log("Doctor already in DB, updating", doctorName)
                                hospitalRecord.doctors[doctorExists] = newDoctorRecord
                                await hospitalRecord.save()
                                globalObject[transactionId].updatedDoctors.push(`${hospitalName} : ${doctorName}`)
                            }
                        }
                        else {
                            console.log("Speciality not in DB", speciality)
                            globalObject[transactionId].notFoundSpecialities.push(speciality)
                        }
                    } else {
                        console.log("Error in parsing experience/fee", { consultationFee, experience })
                        globalObject[transactionId].errors.push(`${hospitalName} : ${doctorName} has invalid experience/consultation fees`)
                    }
                } else {
                    console.log('Hospital not found', hospitalName)
                    globalObject[transactionId].notFoundHospitals.push(hospitalName)
                }
            })
        })
        resolve()
    })
}

module.exports = router