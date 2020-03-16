if(process.env.NODE_ENV === "production") {
    module.exports = {
        PORT: 5000,
        JWT_KEY: 'Make my day!',
        MONGODB_URL: 'mongodb://172.31.19.76:27017/plunesdb2',
        ELASTIC_URL: "http://172.31.41.184:9200",
        RAZORPAY_APP_URL: 'https://plunes.co',
        COUPON_CODES: ['SPAZE10000', 'NILE10000', 'UPPAL10000', 'FEB10000', 'CAREERS360'],
        CREDIT_COUPONS: ['PLUNES300'],
        ES_INDEX: "services",
        ENVIRONMENT: "production",
        PASSWORD: "PlunesAdmin"
    }
} else {
    module.exports = {
        PORT: 5000,
        JWT_KEY: 'Make my day!',
        MONGODB_URL: 'mongodb://localhost:27017/plunesdb2',
        ELASTIC_URL: "http://172.31.41.184:9200",
        RAZORPAY_APP_URL: 'https://plunes.co',
        COUPON_CODES: ['SPAZE10000', 'NILE10000', 'UPPAL10000', 'FEB10000', 'CAREERS360'],
        CREDIT_COUPONS: ['PLUNES300'],
        ES_INDEX: "services_development",
        ENVIRONMENT: "development",
        PASSWORD: "PlunesAdmin"
    }
}


