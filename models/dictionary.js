const mongoose = require('mongoose')

const dictionarySchema = mongoose.Schema({
    keyword: String,
    tag: String
})

dictionarySchema.statics.addTag = (keyword, tag) => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Dictionary.updateOne({ tag }, { $set: { keyword } }, { upsert: true })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

dictionarySchema.statics.deleteTag = tag => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Dictionary.deleteOne({ tag })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

dictionarySchema.statics.deleteKeyword = keyword => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Dictionary.deleteMany({ keyword })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

dictionarySchema.statics.getKeyword = tag => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await Dictionary.findOne({ tag }, 'keyword')
            resolve(result.keyword)
        } catch (e) {
            reject(e)
        }
    })
}

dictionarySchema.statics.getDictionary = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await Dictionary.aggregate([
                {
                    $group: {
                        _id: "$keyword",
                        tags: {$addToSet: "$tag"}
                    }
                }
            ])
            resolve(result)
        } catch(e) {
            reject(e)
        }
    })
}

dictionarySchema.statics.getCollection = () => {
    return new Promise( async (resolve, reject) => {
        try {
            let result = await Dictionary.find()
            let tempObj = {}
            result.forEach(element => {
                tempObj[element.tag] = element.keyword
            })
            resolve(tempObj)
        } catch(e) {
            reject(e)
        }
    })
}

const Dictionary = mongoose.model('dictionary', dictionarySchema)

module.exports = Dictionary
