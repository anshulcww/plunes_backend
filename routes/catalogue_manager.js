const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')
const path = require('path')

const Catalogue = require('../models/catalogue')
const Services = require('../models/services')
const User = require('../models/user')

router = express.Router()

let globalObject = {}

const getServiceId = name => {
    return new Promise(async (resolve, reject) => {
        try {
            Catalogue.aggregate([{
                $match: {
                    'services.service': name
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
                    resolve(serviceIdDocs[0] ? serviceIdDocs[0].serviceId[0]._id.toString() : null)
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

router.post('/uploadCatalog', async (req, res) => {
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

router.post('/uploadHospital', async (req, res) => {
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
            return res.status(200).send(req.file)
        } else {
            return res.status(400).send("Please upload valid (*.xlsx) file")
        }
    })
})

router.post('/submit', async (req, res) => {
    console.log("Upload data submit", req.body.type, req.body.filename)
    if (req.body.type === 'catalog') {
        globalObject[req.body.filename] = {
            addedServices: [],
            namesUpdated: [],
            notFoundSpecialities: [],
            updatedServices: []
        }
        const result = await loadMasterSheet(req.body.filename, path.join(__dirname, '../public/catalogs/', req.body.filename))
        res.status(200).send({
            status: 1,
            data: result,
            msg: 'success'
        })
    } else if (req.body.type === 'hospital') {
        loadMasterSheetTest(path.join(__dirname, '../public/catalogs/', req.body.filename))
        try {
            const result = await loadMasterSheet(req.body.filename, path.join(__dirname, '../public/catalogs/', req.body.filename))
            fs.writeFile(path.join(__dirname, '../public/catalogs/upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                if (err) console.log("Error writing log", err)
                else {
                    delete globalObject[req.body.filename]
                    console.log("Written to log file")
                }
            })
            res.status(200).send({
                status: 1,
                data: result,
                msg: 'success'
            })
        } catch (e) {
            res.status(400).send({
                status: 0,
                data: e,
                msg: 'error'
            })
        }
    } else if (req.body.type === 'hospital') {
        globalObject[req.body.filename] = {
            errors: [],
            notFoundSpecialities: [],
            notFoundServices: []
        }
        try {
            const result = await loadHospitalData(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
            fs.writeFile(path.join(__dirname, '../public/hospitals/upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                if (err) console.log("Error writing log", err)
                else {
                    delete globalObject[req.body.filename]
                    console.log("Written to log file")
                }
            })
            res.status(200).send({
                status: 1,
                data: result,
                msg: 'success'
            })
        } catch (e) {
            res.status(400).send({
                status: 0,
                data: e,
                msg: 'error'
            })
        }
    } else if (req.body.type === 'doctors') {
        globalObject[req.body.filename] = {
            errors: [],
            addedDoctors: [],
            updatedDoctors: [],
            notFoundSpecialities: [],
            notFoundHospitals: []
        }
        try {
            const result = await loadDoctors(req.body.filename, path.join(__dirname, '../public/hospitals/', req.body.filename))
            fs.writeFile(path.join(__dirname, '../public/hospitals/upload_status.log'), JSON.stringify(globalObject[req.body.filename]), err => {
                if (err) console.log("Error writing log", err)
                else {
                    delete globalObject[req.body.filename]
                    console.log("Written to log file")
                }
            })
            res.status(200).send({
                status: 1,
                data: result,
                msg: 'success'
            })
        } catch (e) {
            res.status(400).send({
                status: 0,
                data: e,
                msg: 'error'
            })
        }
    }
})

router.get('/specialities', (req, res) => {
    console.log("Get speciality list")
    Catalogue.distinct('speciality').exec((err, docs) => {
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

router.get('/progress/:id', (req, res) => {
    if (globalObject[req.params.id]) {
        res.status(200).send({
            status: 1,
            data: globalObject[req.params.id],
            msg: "success"
        })
    } else {
        console.log("Reading from log file", req.params.id)
        fs.readFile(path.join(__dirname, '../public/catalogs/', req.params.id), (err, data) => {
            if (err) console.log("Error reading log file", err)
            else {
                res.status(200).send({
                    status: 1,
                    data: JSON.parse(data),
                    msg: "success"
                })
            }
        })
    }
})

const loadMasterSheet = async (transactionId, f) => {
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
                        let updatedServiceName = row[2]
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
                            let j = catalogRecord.services.findIndex(x => x.service == service)
                            if (j == -1) {
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
                                // console.log("Updating record")
                                if (updatedServiceName) {
                                    catalogRecord.services[j].service = updatedServiceName
                                    globalObject[transactionId].namesUpdated.push(service + " -> " + updatedServiceName)
                                }
                                catalogRecord.services[j].details = details
                                catalogRecord.services[j].duration = duration
                                catalogRecord.services[j].sittings = sittings
                                catalogRecord.services[j].dnd = dnd
                                catalogRecord.services[j].tags = tags
                                catalogRecord.services[j].category = category
                                await catalogRecord.save()
                                globalObject[transactionId].updatedServices.push(updatedServiceName || service)
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

const loadHospitalData = async (transactionId, f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    const hospitalName = data[0].sheet[0].row[1][0]
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
            console.log("Sheet name:", sheet.name)
            await asyncForEach(sheet.data.slice(1), async row => {
                if (row.length > 0) {
                    // console.log({row})
                    let speciality = row[2]
                    const catalogueRecord = await Catalogue.findOne({
                        speciality: speciality
                    })
                    if (catalogueRecord) {
                        let specialityId = catalogueRecord._id.toString()
                        let service = row[3]
                        const serviceId = await getServiceId(service)
                        if (serviceId) {
                            let variance = parseInt(row[4])
                            let price = parseInt(row[6])
                            if (variance && price) {
                                tempObj.specialityId = tempObj.specialityId === '' ? specialityId : tempObj.specialityId
                                tempObj.services = tempObj.services.concat({
                                    price: [price],
                                    category: speciality === "Pathologists" || speciality === "Radiologists" ? ["Test"] : ["Procedure"],
                                    serviceId: serviceId,
                                    variance: variance || 35,
                                    homeCollection: false
                                })
                            } else {
                                console.log("Price/variance doesn't exist for", hospitalName, speciality, service)
                                globalObject[transactionId].errors.push(`Price/variance doesn't exist for - ${hospitalName} : ${speciality} : ${service}`)
                            }
                        } else {
                            console.log("Service doesn't exist in DB", service)
                            globalObject[transactionId].notFoundServices.push(service)
                        }
                    } else {
                        console.log('Speciality not found', speciality)
                        globalObject[transactionId].notFoundSpecialities.push(speciality)
                    }
                }
            })
            if (tempObj.services.length > 0) {
                specialitiesArray.push(tempObj)
            }
        })
        hospitalRecordMain.specialities = specialitiesArray
        hospitalRecordMain.save().then(docs => {
            resolve()
        })
            .catch(e => {
                reject("Error")
            })
    } else {
        console.log("Hospital not in DB")
        reject("Hospital not in Database")
    }
}

const loadDoctors = async (transactionId, f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    for (var sheet of data) {
        for (var row of sheet.data.slice(1)) {
            console.log({row})
            let hospitalName = row[0]
            const hospitalRecord = await User.findOne({
                name: hospitalName,
                userType: "Hospital"
            })
            if (hospitalRecord) {
                let doctorName = row[1]
                let speciality = row[2]
                let education = row[3]
                let consultationFee = row[4]
                let experience = row[5]
                let businessHours = "10:00 AM-08:00 PM"
                let service = row[6]

                let doctorExists = hospitalRecord.doctors.findIndex(x => x.name === doctorName)
                if (doctorExists === -1) {
                    console.log("Doctor doesn't exist in DB, adding", doctorName, speciality)
                    let catalogueRecord = await Catalogue.findOne({
                        speciality
                    })
                    if (catalogueRecord) {
                        let serviceExists = catalogueRecord.services.filter(x => x.service === service)
                        if (serviceExists.length === 0) {
                            console.log("Service doesn't exist in DB", service)
                            // Add service to master catalogue
                        } else {
                            console.log("Service exists in DB", serviceExists, serviceExists[0]._id)
                            let specialitiesRecord = {
                                specialityId: catalogueRecord._id,
                                services: [{
                                    serviceId: serviceExists[0]._id,
                                    price: [parseInt(consultationFee)],
                                    variance: 25,
                                    homeCollection: false,
                                    category: 'Consultation'
                                }]
                            }
                            let newDoctorRecord = {
                                name: doctorName,
                                education,
                                designation: "Doctor",
                                experience: parseInt(experience),
                                specialities: [specialitiesRecord],
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
                                }
                                ]
                                // No department, no imageUrl
                            }
                            console.log("New doctor record:", JSON.stringify(newDoctorRecord, undefined, 2))
                            if (hospitalRecord.specialities.findIndex(x => x.specialityId === specialitiesRecord.specialityId) === -1) {
                                console.log("Speciality not in hospital record", specialitiesRecord)
                                hospitalRecord.specialities.push(specialitiesRecord)
                                hospitalRecord.doctors.push(newDoctorRecord)
                                console.log("CONCAT", hospitalRecord.doctors)
                                console.log("Save new record", hospitalRecord)
                                hospitalRecord.save().then(docs => {
                                    console.log("New doctor saved")
                                })
                                    .catch(e => console.error("Error", e))
                            } else {
                                console.log("Speciality already in hospital record")
                                if (hospitalRecord.specialities.services.findIndex(x => x.serviceId === specialitiesRecord.services[0].serviceId) === -1) {
                                    console.log("Service doesn't exist in speciality")
                                    hospitalRecord.specialities.services.push(specialitiesRecord.services)
                                    hospitalRecord.doctors.push(newDoctorRecord)
                                    console.log("Save new record", hospitalRecord)

                                    hospitalRecord.save().then(docs => {
                                        console.log("New doctor saved")
                                    })
                                        .catch(e => console.error("Error", e))
                                }
                            }
                        }
                    } else {
                        console.log("Speciality not in DB", speciality)
                        globalObject[transactionId].notFoundSpecialities.push(speciality)
                    }
                } else {
                    console.log("Doctor alread in DB, updating", doctorName)

                }
                // Add else in case doctor already exists, concat arrays
                // Add skipped Details in catalogue
            } else {
                console.log('Hospital not found', hospitalName)
                globalObject[transactionId].notFoundHospitals.push(hospitalName)
            }
        }
    }
}



// const similarity = (s1, s2) => {
//     var longer = s1;
//     var shorter = s2;
//     if (s1.length < s2.length) {
//         longer = s2;
//         shorter = s1;
//     }
//     var longerLength = longer.length;
//     if (longerLength == 0) {
//         return 1.0;
//     }
//     return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
// }

// const editDistance = (s1, s2) => {
//     s1 = s1.toLowerCase();
//     s2 = s2.toLowerCase();

//     var costs = new Array();
//     for (var i = 0; i <= s1.length; i++) {
//         var lastValue = i;
//         for (var j = 0; j <= s2.length; j++) {
//             if (i == 0)
//                 costs[j] = j;
//             else {
//                 if (j > 0) {
//                     var newValue = costs[j - 1];
//                     if (s1.charAt(i - 1) != s2.charAt(j - 1))
//                         newValue = Math.min(Math.min(newValue, lastValue),
//                             costs[j]) + 1;
//                     costs[j - 1] = lastValue;
//                     lastValue = newValue;
//                 }
//             }
//         }
//         if (i > 0)
//             costs[s2.length] = lastValue;
//     }
//     return costs[s2.length];
// }

module.exports = router
