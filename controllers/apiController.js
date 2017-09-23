'use strict';

const mongoose = require('mongoose');
const Anuncio = mongoose.model('Anuncio');
const Tag = mongoose.model('Tag');
const multer = require('multer');
const uuid = require('uuid'); //Módulo para generar ids
const jimp = require('jimp'); //Comprime fotos
var CustomError = require('../handlers/customError');

mongoose.Promise = global.Promise;

//Configurar multer para subir fotos
const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if(isPhoto) {
            next(null, true);
        } else {
            next(new CustomError(415, req.query.idioma), false);
        }
    }
};


//Lista todos los anuncios de la base de datos en formato JSON o html
exports.getListadoAnuncios = async (req, res, next) =>{
    const Anuncios = await Anuncio.find();

    if(req.baseUrl.indexOf('/api') != -1){//Si la petición proviene del api, devolvemos JSON
        res.json(Anuncios);    
    }else{//Si la petición es para la web, renderizamos el portal y por ello necesitamos también pedir los tags
        const Tags = await Tag.find();
        res.render('index', { title: 'NodePop!', Anuncios: Anuncios, Tags: Tags });
    }  
}


//Lista todos los tags de la base de datos en formato JSON
exports.getListadoTags = async (req, res, next) =>{
  
    //Query para listar todos los tags disponibles para los artículos de la tienda
    const Tags = await Tag.find();
    res.json(Tags);    
}


/* GET anuncios filtrados 
- Lista todos los anuncios de la base de datos en formato JSON o html que cumplen unos determinados criterios
- Los parámetros se pasan vía req.query.
-Los parametros aceptados son los siguientes:
    +tags = Categoría a la que pertenece el artículo
    +venta = Será true si el artículo está a la venta y false si se trata de una búsqueda de un particular
    +nombre = Contendrá parte del nombre de un artículo
    +precio = Rango del precio
-Hay dos filtros para modificar el orden de la lista y el número de resultados
    +sort = Ordena los resultados por el campo indicado (<campo> ascendente) (-<campo> Descendente)
    +limit = Limita el número de resultados a devolver en el JSON
    

Ejemplo:
  /apiv1/anuncios?tag=mobile&venta=false&nombre=ip&precio=50-&start=0&limit=2&sort=precio
*/
exports.getAnunciosFiltrados = async (req, res, next) =>{
    
    const tags = req.query.tags;
    const venta = req.query.venta;
    const nombre = req.query.nombre;
    const precio = req.query.precio;
    //Criterio de ordenación
    const sorter = req.query.sorter;
    //Número de resultados a mostrar
    const limite = req.query.limite;
    //Número de anuncio desde el que comienzo a mostrar
    const start = req.query.start;

    //Declaración del filtro vacío
    const filter = {};

    //Si se ha buscado por uno varios tags
    if(tags){
      let lista = [];
      lista = tags;
      filter.tags = { $in: lista } ;
    }

    //si el producto se vende o se busca
    if(venta){
      filter.venta = venta;
    }

    //Si el nombre comienza por la cadena introducida
    if(nombre){
      filter.nombre = new RegExp('^'+ nombre, "i");
    }

    //Filtro por precio
    if(precio){
      if(precio === '10-'){
          filter.precio = { '$gte': '10' };
      }else if(precio === '10-50'){
          filter.precio = { '$gte': '10', '$lte': '50' };          
      }else if (precio === '-50'){
          filter.precio = { '$lte': '50' };
      }else if (precio === '+50'){
        filter.precio = { '$gte': '50' };
      }else{
        filter.precio = '50';
      }
    }      

    //Recuperar una lista de anuncios de la base de datos
    const Anuncios = await Anuncio.find(filter).limit(parseInt(limite)).skip(parseInt(start)).sort(sorter);
    //Devolvemos JSON de resultados
    res.json(Anuncios);
}


/*Carga la página del formulario de creación de anuncios*/
exports.cargarFormularioCreacion = async function(req, res, next){
    const Tags = await Tag.find();
    res.render('addAnuncio', { title: 'Crear Anuncio', Tags: Tags });
};


exports.upload = multer(multerOptions).single('foto');

exports.guardarFoto = async (req, res, next) => {
    //Comprueba si se necesita hacer resize de la foto
    if(!req.file) {
        next(); //Vete al siguiente middleware
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.foto = `${uuid.v4()}.${extension}`;
    //Now we resize
    const foto = await jimp.read(req.file.buffer);
    await foto.resize(800, jimp.AUTO);
    await foto.write(`./public/images/${req.body.foto}`);
    //Continuamos con el siguiente paso de guardado
    next();
}

/* POST Guarda un anuncio vía POST*/
exports.guardarAnuncio = async (req, res, next) => {
  //Recuperamos los datos en el body del método
  const anuncio = new Anuncio(req.body);
  //Lo guardamos en la base de datos
  const anuncioGuardado = await anuncio.save();
  //Vemos si viene de la web o es una llamada pura al API
  if(req.query.web){
    res.redirect('/');
  }else{
    res.json({success: true, result: anuncioGuardado});
  } 
}