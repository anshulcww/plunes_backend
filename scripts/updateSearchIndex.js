const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const elasticsearch = require('elasticsearch')
const { ELASTIC_URL, ES_INDEX, MONGODB_URL } = require('../config')

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

mongoose.connect(MONGODB_URL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
})

const Catalogue = require('../models/catalogue')
const Services = require('../models/services')

const asyncForEach = async (array, callback) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const createServicesCollection = () => {

    const sendServicesToES = serviceArray => {
        return new Promise( async (resolve, reject) => {
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
                                "type": "text"
                            },
                            "speciality": {
                                "type": "text"
                            }
                        }
                    }
                }
            })
            await asyncForEach(serviceArray, async element => {
                let a = await client.index({
                    index: ES_INDEX,
                    body: element
                })
                console.log(a)
            })
            resolve()
        })
    }

    const addServicesCollection = serviceArray => {
        return new Promise( async (resolve, reject) => {
            await Services.collection.drop();
            console.log("Dropped collection")
            Services.insertMany(serviceArray, (err, docs) => {
                if (err) reject(err)
                else {
                    console.log("Added docs")
                    resolve()
                }
            })
        })
    }

    return new Promise((resolve, reject) => {
        Catalogue.find({}, async (err, catalogueDocs) => {
            if (err) console.log("Error", err)
            else {
                let bigAssArray = []
                catalogueDocs.forEach(element => {
                    element.services.forEach(element1 => {
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
                await addServicesCollection(bigAssArray)
                await sendServicesToES(bigAssArray)
                console.log("Done")
                resolve()
            }
        })
    })
}

createServicesCollection()