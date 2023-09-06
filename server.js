import express from 'express';
import router from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// app.use(
//   bodyParser.urlencoded({
//     limit: '50mb',
//     extended: true,
//     parameterLimit: 50000,
//   })
// );
// Telling express how to handle the user payload
// limit increase the payload
app.use(express.json({ limit: '50mb' }));

// setting the route
app.use('/', router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
