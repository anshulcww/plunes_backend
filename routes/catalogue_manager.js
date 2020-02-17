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

const similarity = (s1, s2) => {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

const editDistance = (s1, s2) => {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue),
                            costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

const loadXlsx = async (f) => {
    const d = xlsx.parse(fs.readFileSync(f))
    var first = true
    for (var s of d) {
        if (first) {
            first = false
            for (var r of s.data) {
                console.log({
                    r
                })
                let sp = r[0]
                let se = r[1]
                let de = r[3]
                let dn = r[6]
                let ta = r[7]

                const c = await Catalogue.findOne({
                    speciality: sp
                })
                if (c) {
                    let j = c.services.findIndex(x => x.service == se)
                    if (j == -1) {
                        console.log('Adding service:', se)
                        c.services = c.services.concat({
                            service: se,
                            details: de,
                            duration: 1,
                            sittings: 1,
                            dnd: dn,
                            tags: ta,
                            category: 'Basic'
                        })
                        await c.save()
                    }
                    // Add skipped Details in catalogue
                    else if (j !== -1) {
                        console.log("Updating record")
                        Catalogue.updateOne({
                            "services.service": se
                        }, {
                            $set: {
                                "services.$.details": de,
                                "services.$.tags": ta
                            }
                        }, (err, updated) => {
                            if (err) console.log("Error", err)
                            else console.log(updated)
                        })
                    }
                } else {
                    console.log('Speciality not found!')
                }
            }
            continue
        }
        // for (var r of s.data) {
        //     // console.log(r)
        //     let m = r[1]
        //     let sp = r[2]
        //     let se = r[3]
        //     let v = 25
        //     let p = parseInt(r[6])
        //     if (!p) {
        //         continue
        //     }
        //     // console.log(m + '|' + sp + '|' + se + '|' + p + '|' + 25)
        //     const c = await Catalogue.find({})
        //     const u = await User.findOne({
        //         mobileNumber: m
        //     })
        //     if (!u) {
        //         continue
        //     }
        //     let i = c.findIndex(x => x.speciality == sp)
        //     if (i != -1) {
        //         let j = c[i].services.findIndex(x => x.service == se)
        //         if (j != -1) {
        //             console.log(c[i].services[j]._id.toString())
        //             let k = u.specialities.findIndex(x => x.specialityId == c[i]._id.toString())
        //             if (k != -1) {
        //                 let l = u.specialities[k].services.findIndex(x => x.serviceId == c[i].services[j]._id.toString())
        //                 if (l == -1) {
        //                     u.specialities[k].services = u.specialities[k].services.concat({
        //                         serviceId: c[i].services[j]._id.toString(),
        //                         price: [p],
        //                         variance: v,
        //                         homeCollection: false,
        //                         category: ['Basic']
        //                     })
        //                     await u.save()
        //                 }
        //             } else {
        //                 u.specialities = u.specialities.concat({
        //                     specialityId: c[i]._id.toString(),
        //                     services: [{
        //                         serviceId: c[i].services[j]._id.toString(),
        //                         price: [p],
        //                         variance: v,
        //                         homeCollection: false,
        //                         category: ['Basic']
        //                     }]
        //                 })
        //                 await u.save()
        //             }
        //         } else {
        //             console.log('Error:', sp, se)
        //         }
        //     } else {
        //         console.log('Error:', sp)
        //     }
        // }
    }
}

const loadXlsxForHospitals = async (f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    var first = true
    for (var sheet of data) {
        if (first) {
            first = false
            for (var row of sheet.data) {
                console.log({
                    row
                })
                let hospitalName = row[0]
                let doctorName = row[1]
                let speciality = row[2]
                let education = row[3]
                let consultationFee = row[4]
                let experience = row[5]
                let businessHours = "10:00 AM-08:00 PM"
                let service = row[6]

                const hospitalRecord = await User.findOne({
                    name: hospitalName,
                    userType: "Hospital"
                })
                if (hospitalRecord) {
                    let doctorExists = hospitalRecord.doctors.findIndex(x => x.name === doctorName)
                    if (doctorExists === -1) {
                        console.log("Doctor doesn't exist in DB, adding", doctorName, speciality)
                        let catalogueRecord = await Catalogue.findOne({
                            speciality
                        })
                        if (catalogueRecord) {
                            console.log("Found speciality in DB", doctorName, speciality)
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
                        }
                    }
                    // Add else in case doctor already exists, concat arrays
                    else {
                        console.log(`Doctor ${doctorName} already exists`)
                    }
                    // Add skipped Details in catalogue
                } else {
                    console.log('Speciality not found!')
                }
            }
            continue
        }
    }
}

const loadXlsxServiceUpdates = async (f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    var first = true
    await asyncForEach(data, async sheet => {
        if (first) {
            first = false
            await asyncForEach(sheet.data, async row => {
                // console.log({ row })
                let hospitalName = row[0]
                let speciality = row[1]
                let oldServiceName = row[2]
                let newServiceName = row[2]
                let price = parseInt(row[4])
                let variance = parseInt(row[5])

                let hospitalRecord = await User.findOne({
                    name: hospitalName,
                    userType: "Hospital"
                })
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
                        await asyncForEach(catalogueRecord.services, async element => {
                            if (element.service === newServiceName || element.service === oldServiceName) {
                                const serviceId = element._id.toString()
                                await asyncForEach(hospitalRecord.specialities, async element => {
                                    if (element.specialityId === specialityId) {
                                        let flag = true
                                        await asyncForEach(element.services, async element1 => {
                                            if (element1.serviceId === serviceId) {
                                                element1.homeCollection = false
                                                element1.variance = variance
                                                element1.category = ["Test"]
                                                element1.price = [price]
                                                await hospitalRecord.save()
                                                console.log("Updated previous record", { hospitalName, speciality, newServiceName })
                                                flag = false
                                            }
                                        })
                                        if (flag) {
                                            const tempObj = {
                                                variance,
                                                category: ["Test"],
                                                serviceId,
                                                price: [price],
                                                homeCollection: false
                                            }
                                            element.services.push(tempObj)
                                            await hospitalRecord.save()
                                            console.log("Saved new record", { hospitalName, speciality, newServiceName })
                                        }
                                    }
                                })
                            }
                        })
                    } else {
                        console.log("Speciality not found in catalogue", speciality)
                    }
                } else {
                    console.log('Hospital not found in DB', hospitalName)
                }
            })
        }
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
    let lifeAidRecord = await User.findOne({
        name: "Dr. Royals Path Lab"
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
    lifeAidRecord.specialities = specialitiesArray
    lifeAidRecord.save().then(docs => {
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

module.exports = router