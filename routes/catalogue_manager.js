const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')
const multer = require('multer')

const Catalogue = require('../models/catalogue')
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

router.post('/upload', async (req, res) => {
    console.log("Upload master catalog for speciality", req.body.speciality)
    await Catalogue.findOne({speciality: req.body.speciality}, async (err, speciality) => {
        if(err) console.log(err)
        else if(!speciality) {
            await new Catalogue({
                speciality: req.body.speciality,
                services: []
            }).save()
            console.log("Created new speciality", req.body.speciality)
        }
    })
    console.log("Upload", req.body.type, req.filename)
    if (req.filename.split(".")[1] && req.filename.split(".")[1].toLowerCase() === 'xlsx') {
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

router.get('/specialities', (req, res) => {
    console.log("Get speciality list")
    Catalogue.find({}, '_id speciality').exec((err, docs) => {
        if(err) {
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

const loadMasterSheet = async (f) => {
    console.log("Upload master sheet")
    let addedServices = []
    let namesUpdated = []
    let notFoundSpecialities = []
    let updatedServices = []
    const data = xlsx.parse(fs.readFileSync(f))
    await asyncForEach(data, async sheet => {
        await asyncForEach(sheet.data, async row => {
            console.log({ row })
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
                    addedServices.push(service)
                }
                else if (j !== -1) {
                    console.log("Updating record")
                    if (updatedServiceName) {
                        catalogRecord.services[j].service = updatedServiceName
                        namesUpdated.push(service + " -> " + updatedServiceName)
                    }
                    catalogRecord.services[j].details = details
                    catalogRecord.services[j].duration = duration
                    catalogRecord.services[j].sittings = sittings
                    catalogRecord.services[j].dnd = dnd
                    catalogRecord.services[j].tags = tags
                    catalogRecord.services[j].category = category
                    await catalogRecord.save()
                    updatedServices.push(updatedServiceName || service)
                }
            } else {
                console.log('Speciality not found!')
                notFoundSpecialities.push(speciality)
            }
        })
    })
}

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

const loadXlsxHospital = async (f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    const hospitalName = data[0].sheet[0].row[1][0]
    let hospitalRecordMain = await User.findOne({
        name: hospitalName
    })
    let specialitiesArray = []

    await asyncForEach(data, async sheet => {
        let tempObj = {
            specialityId: '',
            services: []
        }
        console.log("SHEET", sheet.name)
        let first = true
        await asyncForEach(sheet.data, async row => {
            if (row.length > 0) {
                // console.log({row})
                if (!first) {
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

                            tempObj.specialityId = tempObj.specialityId === '' ? specialityId : tempObj.specialityId
                            tempObj.services = tempObj.services.concat({
                                price: [price],
                                category: speciality === "Pathologists" || speciality === "Radiologists" ? ["Test"] : ["Procedure"],
                                serviceId: serviceId,
                                variance: variance || 35,
                                homeCollection: false
                            })
                        } else {
                            console.log("Service doesn't exist in DB", service)
                        }
                    } else {
                        console.log("Speciality not in DB", speciality)
                    }
                } else {
                    first = false
                }
            } else {
                // console.log("Empty row")
            }
        })
        if (tempObj.services.length > 0) {
            specialitiesArray.push(tempObj)
        }
    })
    // console.log(JSON.stringify(specialitiesArray, undefined, 2))
    hospitalRecordMain.specialities = specialitiesArray
    hospitalRecordMain.save().then(docs => {
        process.exit(1)
        // console.log("Data saved", docs)
    })
        .catch(e => {
            console.log("Error", e)
        })
}

const loadXlsxSpeciality = async (f) => {
    console.log("Load Opthalmologists")
    const data = xlsx.parse(fs.readFileSync(f))
    await asyncForEach(data, async sheet => {
        console.log("Got hospital name", sheet.data[1][0])
        await asyncForEach(sheet.data, async row => {
            // console.log({ row })
            let hospitalName = row[0]
            let speciality = row[2]
            let oldServiceName = row[3]
            let newServiceName = row[3]
            let variance = parseInt(row[4])
            let price = parseInt(row[6]) || 0

            var hospitalRecord = await User.findOne({
                name: hospitalName,
                userType: "Hospital"
            })

            if (price > 100) {
                if (hospitalRecord) {
                    await Catalogue.updateMany({
                        "services.service": oldServiceName
                    }, {
                        $set: {
                            "services.$.service": newServiceName
                        }
                    })
                    // console.log("Updated name", updateSpeciality)
                    let catalogueRecord = await Catalogue.findOne({
                        speciality
                    })
                    if (catalogueRecord) {
                        const specialityId = catalogueRecord._id.toString()
                        // console.log("Got speciality ID", specialityId)
                        const serviceId = await getServiceId(newServiceName)
                        if (serviceId) {
                            let specialityFlag = true
                            await asyncForEach(hospitalRecord.specialities, async element => {
                                if (element.specialityId === specialityId && element.services.length > 0) {
                                    let flag = true
                                    specialityFlag = false
                                    await asyncForEach(element.services, async element1 => {
                                        if (element1.serviceId === serviceId) {
                                            // console.log("Found service", element1.serviceId, serviceId)
                                            element1.homeCollection = false
                                            element1.variance = variance
                                            element1.category = ["Procedure"]
                                            element1.price = [price]
                                            // console.log("Saving record", { element, element1 })
                                            try {
                                                await hospitalRecord.save()
                                            } catch (e) {
                                                console.log("--")
                                            }
                                            flag = false
                                        }
                                    })
                                    if (flag) {
                                        const tempObj = {
                                            variance,
                                            category: ["Procedure"],
                                            serviceId,
                                            price: [price],
                                            homeCollection: false
                                        }
                                        element.services.push(tempObj)
                                        try {
                                            await hospitalRecord.save()
                                            console.log("Added service to record", newServiceName)
                                        }
                                        catch (e) { console.log("Error adding", e) }
                                    }
                                }
                            })
                            if (specialityFlag) {
                                console.log("Speciality not in hospital record", speciality)
                                hospitalRecord.specialities.push({
                                    specialityId,
                                    services: [
                                        {
                                            variance,
                                            category: ["Procedure"],
                                            serviceId,
                                            price: [price],
                                            homeCollection: false
                                        }
                                    ]
                                })
                                try {
                                    await hospitalRecord.save()
                                } catch (e) {
                                    console.log("Error1", e)
                                }
                            }
                        } else {
                            console.log("Service not found in catalogue", newServiceName)
                        }
                    } else {
                        console.log("Speciality not found in catalogue", speciality)
                    }
                } else {
                    console.log('Hospital not found in DB', hospitalName, row)
                }
            } else {
                console.log("Price less than threshold value", price)
            }
        })
    })
    console.log("Upload complete")
    process.exit(1)
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