const express = require('express')
const mongoose = require('mongoose')
const fs = require('fs')
const xlsx = require('node-xlsx')
const elasticsearch = require('elasticsearch')
const Catalogue = require('../models/catalogue')
const Services = require('../models/services')
const User = require('../models/user')
const auth = require('../middleware/auth')
const { ELASTIC_URL, ES_INDEX } = require('../config')

router = express.Router()

var catalogue = undefined

var client = new elasticsearch.Client({
    hosts: [ELASTIC_URL]
})

router.get('/', async (req, res) => {
    try {
        if (!catalogue) {
            catalogue = await Catalogue.find({})
        }
        res.status(201).send(catalogue)
    } catch (error) {
        res.status(400).send('missing catalogue')
    }
})

router.post('/search', async (req, res) => {
    console.log("Search", `/${req.body.expression}/`, req.body.expression.length)
    if (req.body.page || req.body.page === 0) {
        const limit = parseInt(req.body.limit) || 10
        const skip = parseInt(req.body.page) * limit
        req.body.expression = req.body.expression.toLowerCase()
        try {
            const catalogue = await client.search({
                "index": ES_INDEX,
                "from": skip,
                "size": limit,
                "_source": ["service", "category", "serviceId", "details", "dnd", "sittings", "duration", "speciality"],
                "body": {
                    "sort": [
                        {
                            "_score": {
                                "order": "desc"
                            }
                        }
                    ],
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "query_string": {
                                        "query": `${req.body.expression}*`,
                                        "analyze_wildcard": true,
                                        "fuzziness": "AUTO",
                                        "fuzzy_prefix_length": 3,
                                        "fields": ["service_lowercase^2", "tags^0.5"]
                                    }
                                }
                            ],
                            "filter": [],
                            "should": [],
                            "must_not": []
                        }
                    },
                }
            })
            let resultArray = catalogue.hits.hits.map(element => element["_source"])
            res.status(200).send(resultArray)
        } catch (e) {
            console.log("Error", e)
            res.status(400).send({
                status: false,
                data: e,
                msg: "error"
            })
        }
    } else {
        res.status(400).send({
            status: false,
            data: [],
            msg: "specify limit/page"
        })
    }
})

router.get('/category/:category', (req, res) => {
    console.log("Get category list", req.params.category)
    if (req.params.category) {
        if (req.params.category === "consultations") {
            Services.find({ category: "Consultation" }, '-tags -_id', (err, consultationList) => {
                if (err) {
                    res.status(400).send()
                    console.log(err)
                } else {
                    res.status(200).send(consultationList)
                }
            })
        }
        else if (req.params.category === "tests") {
            Services.aggregate([{ $match: { category: "Test" } }, { $group: { _id: '$speciality', specialityId: { $addToSet: '$specialityId' } } }, { $unwind: "$specialityId" }], (err, testList) => {
                if (err) {
                    res.status(400).send()
                    console.log(err)
                } else {
                    res.status(200).send(testList)
                }
            })
        }
        else if (req.params.category === "procedures") {
            Services.aggregate([{ $match: { category: "Procedure" } }, { $group: { _id: '$speciality', specialityId: { $addToSet: '$specialityId' } } }, { $unwind: "$specialityId" }], (err, procedureList) => {
                if (err) {
                    res.status(400).send()
                    console.log(err)
                } else {
                    res.status(200).send(procedureList)
                }
            })
        }
        else {
            res.status(400).send("Please specify valid category")
        }
    }
})

router.post('/serviceList', async (req, res) => {
    console.log(`Get list of ${req.body.type} for ${req.body.specialityId}, filter ${req.body.expression}, page ${req.body.page}`)
    if (req.body.type && req.body.specialityId) {
        let category = ''
        let skip = req.body.page || 0
        if (req.body.type === 'tests') {
            category = "Test"
        } else if (req.body.type === 'procedures') {
            category = "Procedure"
        }
        if (category && req.body.specialityId) {
            try {
                const catalogue = await client.search({
                    "index": ES_INDEX,
                    "from": skip * 10,
                    "size": 10,
                    "_source": ["service", "category", "serviceId", "details", "dnd", "sittings", "duration", "speciality"],
                    "body": {
                        "sort": [
                            {
                                "_score": {
                                    "order": "desc"
                                }
                            }
                        ],
                        "query": {
                            "bool": {
                                "must": [
                                    {
                                        "query_string": {
                                            "query": `${req.body.expression}*`,
                                            "analyze_wildcard": true,
                                            "fuzziness": "AUTO",
                                            "fuzzy_prefix_length": 3,
                                            "fields": ["service_lowercase^2", "tags^0.5"]
                                        }
                                    },
                                    {
                                        "match": {
                                            "specialityId": req.body.specialityId
                                        }
                                    },
                                    {
                                        "match": {
                                            "category": category
                                        }
                                    }
                                ],
                                "filter": [],
                                "should": [],
                                "must_not": []
                            }
                        },
                    }
                })
                let resultArray = catalogue.hits.hits.map(element => element["_source"])
                res.status(200).send(resultArray)
            } catch (e) {
                res.status(400).send()
                console.log(e)
            }
        } else {
            res.status(400).send("Please specify valid category")
        }
    }
})

// ----------------------------------- OLD APIs BELOW THIS --------------------------------------------------

const addService = async (user, specialityId, serviceId, price, variance, homeCollection, category) => {
    console.log(specialityId, serviceId, price, variance, homeCollection, category)
    var index = user.specialities.findIndex(s => s.specialityId == specialityId)
    if (index == -1) {
        user.specialities = user.specialities.concat({
            specialityId: specialityId,
            services: []
        })
        index = user.specialities.length - 1
    }
    if (user.specialities[index].services.findIndex(s => s.serviceId == serviceId) == -1) {
        user.specialities[index].services = user.specialities[index].services.concat({
            serviceId: serviceId,
            price: price,
            variance: variance,
            homeCollection: homeCollection,
            category: category
        })
        await user.save()
    }
}

router.post('/upsert', async (req, res) => {
    try {
        let messages = []
        for (var r of req.body) {
            const s = await Catalogue.findOne({
                speciality: r.speciality
            })
            if (s) {
                const i = s.services.findIndex(s => s.service == r.service)
                if (i == -1) {
                    s.services = s.services.concat({
                        service: r.service,
                        details: r.details,
                        duration: r.duration,
                        sittings: r.sittings,
                        dnd: r.dnd,
                        tags: r.tags,
                        category: r.category
                    })
                    messages = messages.concat(r.service + ' added!')
                } else {
                    s.services[i].details = r.details
                    s.services[i].duration = r.duration
                    s.services[i].sittings = r.sittings
                    s.services[i].dnd = r.dnd
                    s.services[i].tags = r.tags
                    s.services[i].category = r.category
                    messages = messages.concat(r.service + ' updated!')
                }
                await s.save()
            }
            messages = messages.concat('Invalid speciality: ' + r.speciality)
        }
        res.status(201).send({
            success: true,
            messages: messages
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

// router.get('/anjali', async (req, res) => {
//     const u = await User.mobileNumberExists('9818345055')
//     const d = JSON.parse(fs.readFileSync('./plunes-db/anjali.json'))
//     for (var s of d) {
//         const a = await Catalogue.findServiceDetails(s.name)
//         if (a.length > 0 && s.procedure_price > 0) {
//             console.log('Added:', s.name)
//             await addService(u, a[0], a[1], [s.procedure_price], s.procedure_variance, false, ['Basic'])
//         } else {
//             console.log('Not added:', s.name)
//         }
//     }

//     res.status(201).send({
//         success: true
//     })
// })

// router.get('/opth', async (req, res) => {
//     const data = JSON.parse(fs.readFileSync('./plunes-db/chirag.json'))
//     var s = await Catalogue.findOne({
//         speciality: /Ophthal/
//     })
//     // console.log(s.speciality)
//     // for (var r of data[0].data) {
//     //     // console.log(r)
//     //     if (!r[1] || r[0] == 'CODE') {
//     //         continue
//     //     }
//     //     // const d = await Catalogue.findServiceDetails(r[1])
//     //     // console.log(d)
//     //     const index = s.services.findIndex(v => v.service == r[1])
//     //     console.log(index)
//     //     if (index != -1) {
//     //         console.log('Fixing:', r[1])
//     //         s.services[index].details = r[2]
//     //         s.services[index].dnd = r[3]
//     //         s.services[index].tags = r[4]

//     //         // s.services = s.services.concat({
//     //         //     service: r[1],
//     //         //     details: r[2],
//     //         //     dnd: r[3],
//     //         //     tags: r[4]
//     //         // })
//     //     } else {
//     //         console.log('Not adding:', r[1])
//     //     }
//     // }
//     // await s.save()
//     const u = await User.findOne({
//         name: /Chirag/
//     })
//     console.log(u.name)
//     for (var r of data) {
//         console.log(r)
//         const d = await Catalogue.findServiceDetails(r.PROCEDURE)
//         console.log(d)
//         if (d.length > 0) {
//             console.log('Adding:', r.PROCEDURE)
//             await addService(u, d[0], d[1], [r['GENERAL WARD'], r['SEMI PRIVATE'], r['PRIVATE'], r['DELUXE']], 25, false, ['General Ward', 'Semi Private', 'Private', 'Deluxe'])
//         }
//     }
//     res.status(201).send({
//         success: true
//     })
// })

router.get('/check_services', async (req, res) => {
    const users = await User.find({})
    const catalogue = await Catalogue.find({})
    var good = 0,
        bad = 0
    for (var u of users) {
        for (var s of u.specialities) {
            const a = s.specialityId
            for (var v of s.services) {
                const b = v.serviceId
                const i = catalogue.findIndex(c => c._id.toString() == a)
                if (i != -1) {
                    const j = catalogue[i].services.findIndex(x => x._id.toString() == b)
                    if (j != -1) {
                        // console.log(u.name, a, b, 'Ok!')
                        good++
                        continue
                    }
                }
                // console.log(u.name, await Catalogue.findSpecialityName(a), await Catalogue.findServiceName(b), 'Error!')
                console.log(u.name)
                bad++
            }
        }
    }
    console.log(good, bad)
    res.status(201).send({
        success: true
    })
})

/*
router.get('/addsome', async (req, res) => {
    try {
        const a = ['Psychiatrist', 'Diebtology', 'Oncologist', 'Audiologist', 'Urology', 'Allergist', 'Plastic Surgeon', 'Vet', 'Obstetrics']
        for (var s of a) {
            console.log(s)
            const e = new Catalogue({
                speciality: s,
                services: [{
                    service: s + ' Consultation'
                }]
            })
            await e.save()
        }
        res.status(201).send({
        })
            success: true
    } catch (error) {
        res.status(400).send(error)
    }
})
*/

module.exports = router
