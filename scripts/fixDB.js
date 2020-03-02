const mongoose = require('mongoose')
const fs = require('fs')
const xlsx = require('node-xlsx')
const ObjectId = mongoose.Types.ObjectId
const Config = require('../config')
const elasticsearch = require('elasticsearch')
const { ELASTIC_URL, ES_INDEX } = require('../config')

let client = new elasticsearch.Client({
    hosts: [ELASTIC_URL]
})

client.ping({
    requestTimeout: 30000,
}, function (error) {
    if (error) {
        console.error('elasticsearch cluster is down!');
    } else {
        console.log('Connected to elasticsearch');
    }
});

mongoose.connect(Config.MONGODB_URL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
})

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const Services = require('../models/services')

const createServicesCollection = () => {
    return new Promise((resolve, reject) => {
        Catalogue.find({}, (err, catalogueDocs) => {
            if (err) console.log("Error", err)
            else {
                let bigAssArray = []
                catalogueDocs.forEach(element => {
                    element.services.forEach(element1 => {
                        // console.log(element1.service ? element1.service.toLowerCase() : '')
                        let smallObject = {
                            speciality: element.speciality,
                            specialityId: ObjectId(element._id),
                            serviceId: ObjectId(element1._id),
                            service: element1.service,
                            service_lowercase: element1.service ? element1.service.toLowerCase() : '',
                            details: element1.details,
                            duration: element1.duration,
                            sittings: element1.sittings,
                            dnd: element1.dnd,
                            tags: element1.tags ? element1.tags.toLowerCase() : '',
                            category: element1.category
                        }
                        bigAssArray.push(smallObject)
                    })
                })
                console.log("Got through it")
                sendServicesToES(bigAssArray)
                addServicesCollection(bigAssArray)
                // Services.insertMany(bigAssArray, (err, docs) => {
                //     if (err) console.log("Error", err)
                //     else console.log("Added docs", docs)
                // })
            }
        })
    })
}

const sendServicesToES = async serviceArray => {
    await client.indices.delete({ index: ES_INDEX })
    console.log("Deleted index")
    await client.indices.create({
        index: ES_INDEX,
        body: {
            "settings": {
                "analysis": {
                    "analyzer": {
                        "my_analyzer": {
                            "tokenizer": "my_tokenizer"
                        }
                    },
                    "tokenizer": {
                        "my_tokenizer": {
                            "type": "edge_ngram",
                            "token_chars": [
                                "letter",
                                "digit"
                            ]
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "tags": {
                        "type": "text"
                    },
                    "service_lowercase": {
                        "type": "text"
                    },
                    "details": {
                        "type": "text",
                        "index": false
                    },
                    "service": {
                        "type": "text",
                        "index": false
                    },
                    "dnd": {
                        "type": "text",
                        "index": false
                    },
                    "category": {
                        "type": "text",
                        "index": false
                    },
                    "speciality": {
                        "type": "text",
                        "index": false
                    }
                }
            }
        }
    })
    await asyncForEach(serviceArray, async element => {
        let a = await client.index({
            index: ES_INDEX,
            // type: "service",
            body: element
        })
        console.log(a)
    })
}

const addServicesCollection = async serviceArray => {
    await Services.collection.drop();
    console.log("Dropped collection")
    Services.insertMany(serviceArray, (err, docs) => {
        if (err) console.log("Error", err)
        else console.log("Added docs")
    })
}

// createServicesCollection()

const removeDuplicateServices = () => {
    return new Promise(async (resolve, reject) => {
        console.log("Remove duplicates")
        let serviceCollection = await Services.find({})
        let servicesArray = []
        await asyncForEach(serviceCollection, async element => {
            const index = servicesArray.findIndex(value => value.service === element.service)
            // console.log(index)
            if (index === -1) {
                servicesArray.push({ service: element.service, id: element.serviceId })
            } else {
                Services.deleteOne({ _id: element._id })
                console.log("Removed duplicate from services collection", element)
            }
        })
        console.log("Saved unique service collection")
        resolve(servicesArray)
    })
}

const removeDuplicateUserServices = (servicesArray) => {
    return new Promise(async (resolve, reject) => {
        console.log("Remove duplicate user services")
        let catalogue = await Catalogue.find()
        let users = await User.find()
    })
}

// removeDuplicateServices()

const removeExtraServices = async () => {
    let catalogue = await Catalogue.find()
    await asyncForEach(catalogue, async speciality => {
        let serviceArray = []
        // console.log({ speciality })
        await asyncForEach(speciality.services, async service => {
            const serviceId = service._id.toString()
            let userRecords = await User.findOne({ $or: [{ "specialities.services.serviceId": serviceId.toString() }, { "doctors.specialities.services.serviceId": serviceId.toString() }] })
            // console.log({ userRecords })
            if (userRecords) {
                console.log("Service mapped to user")
            } else {
                console.log("Service not mapped to user")
                serviceArray.push(service.service)
            }
        })
        console.log({ serviceArray })
        if (serviceArray.length > 0) {
            let result = await Catalogue.updateOne({ _id: mongoose.Types.ObjectId(speciality._id) }, { $pullAll: { "services.service": serviceArray } })
            console.log("Pulled services", result)
        }
    })
}

removeExtraServices()

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

const addService = async (m, sp, se, p, v) => {
    const u = await User.findOne({
        mobileNumber: m
    })
    if (u) {
        const c = await Catalogue.findOne({
            speciality: sp
        })
        if (c) {
            let i = c.services.findIndex(x => x.service == se)
            if (i != -1) {
                let j = u.specialities.findIndex(x => x.specialityId == c._id.toString())
                if (j == -1) {
                    u.specialities = u.specialities.concat({
                        specialityId: c.services[i]._id.toString(),
                        services: []
                    })
                    await u.save()
                    j = u.specialities.length - 1
                }
                u.specialities[j].services = u.specialities[j].services.concat({
                    serviceId: c.services[i]._id.toString(),
                    price: [p],
                    variance: v,
                    homeCollection: false,
                    category: ['Basic']
                })
            }
        }
    }
}

const checkServices = async () => {
    const users = await User.find({})
    const catalogue = await Catalogue.find({})

    for (var u of users) {
        let S = []
        for (var s of u.specialities) {
            let i = catalogue.findIndex(x => x._id.toString() == s.specialityId)
            if (i == -1) {
                console.log('Error:', u.name, s.specialityId)
                continue
            }
            let SS = []
            for (var ss of s.services) {
                let j = catalogue[i].services.findIndex(x => x._id.toString() == ss.serviceId)
                if (j == -1) {
                    console.log('Error:', u.name, s.specialityId, ss.serviceId)
                    continue
                }
                delete ss._id
                SS = SS.concat(ss)
                console.log('OK:', s.specialityId, ss.serviceId, catalogue[i].speciality, catalogue[i].services[j].service)
            }
            S = S.concat({
                specialityId: s.specialityId,
                services: SS
            })
        }
        // u.specialities = S
        // await u.save()
        // console.log(u.name, JSON.stringify(S))
    }
}

// checkServices()

const fixDB = async () => {
    const users = await User.find({})

    for (var user of users) {
        console.log(user.name)
        let services = {}
        for (var sp of user.specialities) {
            let newServices = []
            for (var se of sp.services) {
                console.log(se.serviceId)
                if (se.serviceId in services) {
                    console.log('Duplicate: ' + se.serviceId)
                } else {
                    services[se.serviceId] = 1
                    newServices = newServices.concat(se)
                }
            }
            sp.services = newServices
            console.log(newServices)
        }
        await user.save()
    }
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

const loadXlsxLifeAid = async (f) => {
    const data = xlsx.parse(fs.readFileSync(f))
    let lifeAidRecord = await User.findOne({
        name: "CLCD Diagnostics & Research Center"
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
                                category: speciality === "Pathologists" || speciality === "Radiologists" || speciality === "Health Package" ? ["Test"] : ["Procedure"],

                                serviceId: serviceId,
                                variance: variance || 45,
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

const removeDuplicates = () => {
    return new Promise(async (resolve, reject) => {
        console.log("Remove duplicates")
        let serviceCollection = await Services.find()
        let catalogue = await Catalogue.find()
        let users = await User.find()

        let servicesArray = []
        serviceCollection.forEach(async element => {
            const index = servicesArray.findIndex(value => value.service === element.service)
            if (index === -1) {
                servicesArray.push({ service: element.service, id: element.serviceId })
            } else {
                const removeElement = await Services.deleteOne({ _id: element._id })
                console.log("Removed duplicate from services collection", removeElement)
            }
        })
        await serviceCollection.save()
        console.log("Saved unique service collection")


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

const fixMisc = async (filename) => {
    const misc = await Catalogue.findOne({
        speciality: 'Miscellaneous'
    })
    const data = xlsx.parse(fs.readFileSync(filename))
    for (var sheet of data) {
        for (var row of sheet.data) {
            console.log(row)
            if (row[0] == 'Miscellaneous') {
                a = row[0]
                b = row[1]
                c = row[2]
                d = row[3]
            }
            const s = await Catalogue.findOne({
                speciality: b
            })
            if (!s) {
                continue
            }
            let j = s.services.findIndex(x => x.service == d)
            console.log('j: ' + j)
            // if (j == -1) {
            //     s.services = s.services.concat({
            //         service: d,
            //         details: d,
            //         duration: 1,
            //         sittings: 1,
            //         dnd: '',
            //         tags: d,
            //         category: 'Test'
            //     })
            //     // await s.save()
            // }
            let i = misc.services.findIndex(x => x.service == c)
            if (i == -1) {
                continue
            }
            let mid = misc._id.toString()
            let fid = misc.services[i]._id.toString()
            let sid = s._id.toString()
            let tid = s.services[j]._id.toString()
            console.log(fid, tid)
            if (i != -1) {
                console.log('i: ' + misc.services[i]._id.toString())
                let sid = misc.services[i]._id.toString()
                let u_ = await User.find({
                    'specialities.services.serviceId': fid
                })
                let sd = false
                for (var u of u_) {
                    for (var sp of u.specialities) {
                        if (sp.specialityId == mid) {
                            let p = sp.services.findIndex(x => x.serviceId == fid)
                            if (p != -1) {
                                sd = sp.services[p]
                            }
                        }
                    }
                }
                console.log(sd)
                if (sd) {
                    delete sd._id
                    sd.serviceId = tid
                    let k = u.specialities.findIndex(x => x.specialityId == sid)
                    if (k == -1) {
                        u.specialities = u.specialities.concat({
                            specialityId: sid,
                            services: [sd]
                        })
                    } else {
                        u.specialities[k].services = u.specialities[k].services.concat(sd)
                    }
                    await u.save()
                    console.log(u.name + ' migrated service')
                }
            }
        }
    }
}

// fixMisc('./plunes-db/misc.xlsx')
