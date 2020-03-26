const mongoose = require('mongoose')

const blogSchema = mongoose.Schema({
    title: {
        type: String,
        unique: true
    },
    tags: String,
    description: String,
    body: [String],
    uriTag: {
        type: String,
        unique: true
    },
    imageUrl: {
        type: String
    },
    author: {
        type: String
    }
}, { timestamp: true })

blogSchema.statics.addPost = newPost => {
    return new Promise(async (resolve, reject) => {
        newPost.body = newPost.body.split('\n')
        try {
            const newPost = await Blog.updateOne({ title: newPost.title }, {
                $set: {
                    ...newPost
                }
            }, { upsert: true })
            resolve(newPost)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.getPost = uriTag => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.findOne({ uriTag })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.deletePost = title => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.deleteOne({ title })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.getPostList = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await Blog.find().sort({ _id: -1 })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

const Blog = mongoose.model('blogs', blogSchema)

module.exports = Blog