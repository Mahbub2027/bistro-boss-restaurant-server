const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// jwt middleware
// const verifyToken = (req, res, next) =>{
//   console.log("inside middleware", req.headers)
//   if(!req.headers.authorization){
//     return res.status(401).send({message: 'forbidden access'})
//   }
//   const token = req.headers.authorization.split(' ')[1];
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
//     if(err){
//       return res.status(401).send({message: 'forbidden access'})
//     }
//     req.decoded = decoded;
//     next();
//   })
// }


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l5wiuzk.mongodb.net/?retryWrites=true&w=majority`;

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

    const userCollection = client.db('bistroDB').collection('users');
    const menuCollection = client.db('bistroDB').collection('menu');
    const reviewCollection = client.db('bistroDB').collection('reviews');
    const cartCollection = client.db('bistroDB').collection('carts');
    const paymentCollection = client.db('bistroDB').collection('payments');


    // jwt releted api
    app.post('/jwt', async(req, res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '5h'});
      res.send({token})
    })

    // middlewares 
    // verify Token
    const verifyToken = (req, res, next) =>{
      console.log("inside middleware", req.headers.authorization)
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    // verify admin after verifyToken
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.plot === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }



    // user collection
    app.post('/users', async(req, res)=>{
      const user = req.body;
      // insert user if user doesn't exits
      const query = {email: user.email}
      const exitstingUser = await userCollection.findOne(query);
      if(exitstingUser){
        return res.send({message: 'user already exits', insertedId: null})
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', verifyToken, verifyAdmin, async(req, res)=>{
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req, res)=>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email}
      const user = await userCollection.findOne(query)
      let admin = false;
      if(user){
        admin = user?.plot === 'admin';
      }
      res.send({admin});


    })

    // for make an admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set : {
          plot: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    
    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // menu collection
    app.get('/menu', async(req, res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    // for update data
    app.get('/menu/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query);
      res.send(result);
    })
    
    app.patch('/menu/:id', async(req, res)=>{
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.post('/menu',verifyToken, verifyAdmin, async(req, res)=>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })


    // reviews collection
    app.get('/reviews', async(req, res)=>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    // cart collection
    app.post('/carts', async(req, res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })

    app.get('/carts', async(req, res)=>{
      console.log(req.query.email)
      let query = {};
      if(req.query?.email){
        query = { email: req.query.email}
      }
      // const email = req.query.email;
      // const query = { email: email }

      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/carts/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // payment stripe

    app.post('/create-payment-intent', async(req,res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'total amount')
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency : "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })

    })

    app.post('/payments', async(req, res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log('payment info', payment)
      const query = {_id: {
        $in: payment.cartIds.map(id=> new ObjectId(id))
      }};

      const deleteResult = await cartCollection.deleteMany(query)
      res.send({paymentResult, deleteResult})

    })

    app.get('/payments/:email', verifyToken, async(req, res)=>{
      const query = {email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentCollection.find().toArray(query);
      res.send(result);
    })

    // stats & analytics
    app.get('/admin-stats',verifyToken, verifyAdmin, async(req, res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const menuItem= await menuCollection.estimatedDocumentCount();
      const orders  = await paymentCollection.estimatedDocumentCount();
      // this is not best way
      // type 1
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment)=> total + payment.price ,0).toFixed(2)
      // type 2
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenu: {
              $sum : '$price'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenu: 0;

      res.send({
        users,
        menuItem,
        orders,
        revenue
      });
 
    })

    // using aggregate pipeline M-71.6-7
    app.get('/order-stats',verifyToken, verifyAdmin, async(req, res)=>{
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuIds',
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuIds',
            foreignField: '_id',
            as: 'menuItems' 
          } 
        },
        {
          $unwind: '$menuItems',
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1},
            revenue: { $sum: '$menuItems.price'}
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue',
          }
        }

      ]).toArray();
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res)=>{
    res.send('Bistro boss is running...')
})
app.listen(port, ()=>{
    console.log(`Bistro boss is sitting on port ${port}`);
})   