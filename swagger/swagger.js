const swaggerUi=require('swagger-ui-express');
const spec={
 openapi:'3.0.0',
 info:{title:'ActOn Issues API',version:'1.0.0'},
 paths:{}
};
module.exports=(app)=>{
 app.use('/api-docs',swaggerUi.serve,swaggerUi.setup(spec));
};
