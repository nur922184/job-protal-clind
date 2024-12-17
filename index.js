const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
//
//

app.use(cors({
    origin: ['http://localhost:5173'], 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const logger = (req, res, next) =>{
  console.log('inside the logger'); 
next();  
}; 

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token; 
    // console.log('inside verify token middlewa', req.cookies)
    if(!token){
        return res.status(401).send({message: 'UnAuthorized access '})
    }
     
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if(err){
            return res.status(401).send({message: 'UnAuthorized access'})
        }
        req.user = decoded;
        next();
    })
   
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hq6na.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

//Auth related Api

        app.post('/jwt', async(req, res)=>{
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, {expiresIn: '2d'})
            res
            .cookie('token', token, {
                httpOnly: true, 
                secure: false,
            })
            .send({success: true})
        })

        app.post('/logout', (req, res) =>{
            res.clearCookie('token', {
                httpOnly: true, 
                secure: false
            })
            .send({success: true})
        })


        // job related api 
        const jobCollection = client.db('job-portal-mongobd').collection('jobs')
        const jobApplicationCollection = client.db('job-portal-mongobd').collection('job_application')


        app.get('/jobs', logger, async (req, res) => {
            console.log('NOW OTHERS WAY API CALLBACK')
            const email = req.query.email;
            let query={};
            if(email){
                query ={hr_email: email}
            }
            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobCollection.findOne(query)
            res.send(result);
        })
        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob)
            res.send(result)
        })

        app.get('/job-application',  verifyToken,  async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email }

            console.log('cok cok cok cookies', req.cookies?.token);

            if(req.user.email !== req.query.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const result = await jobApplicationCollection.find(query).toArray();


              // fokira way to aggregate data
              for (const application of result) {
                // console.log(application.job_id)
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobCollection.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.location = job.location;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                }
            }

            res.send(result);
        })

        app.get('/job-application/jobs/:job_id', async(req, res)=>{
            const jobId = req.params.job_id;
            const query = {job_id: jobId}
            const result = await jobApplicationCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/job-application', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application)
            res.send(result)
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Job portal server is running')
})

app.listen(port, () => {
    console.log(`Job Portal server running on port:${port}`)
})