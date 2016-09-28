
var less = require('less')
var util = require('./util')
var processParameters = util.processParameters;
var processDescription = util.processDescription;
var resourceObject = util.resourceObject;
var slugCache = util.slugCache;
var join = util.join;
var md = util.md;


// Get the theme's configuration options
exports.getConfig = function () {
  return {
    formats: ['1A'],
    
    options: [
      {
        name: 'name',
        description: 'Your name',
        default: 'world'
      }
    ]
  };
}

// Asyncronously render out a string
exports.render = function (input, options, done) {
  input.description = processDescription(input.description)
  
  var apiDs = { resourceGroups: [] }
  apiDs.resourceGroups.push({
    name: 'Overview',
    description: input.description
  });
  var navGroups = {};
  navGroups.Overview = slugCache._nav;
  slugCache._nav = [];
  var resourceGroups = input.resourceGroups;




  resourceGroups.forEach(function(resourceGroup) {
    /*var resObj = resourceObject(resourceGroup.description);

    if (resObj && resObj.objects) {
      resourceGroup.description = resObj.description;
      if (!resourceGroup.resources) {
        resourceGroup.resources = [];
      }
      resourceGroup.resources = resObj.objects.concat(resourceGroup.resources);
    }

    if (resourceGroup.resources && resourceGroup.resources.length) {
      for(var i = 0; i < resourceGroup.resources.length; i++) {
        resObj = resourceObject(resourceGroup.resources[i].description); 
        if (resObj && resObj.objects) {
          resourceGroup.resources[i].description = resObj.description;
          resObj.objects.forEach(function(obj) {
            resourceGroup.resources.splice(i++, 0, obj);
          });
        }
      }
    }*/
    var rgData = {
      name: resourceGroup.name,
      description: processDescription(resourceGroup.description),
      resources: resourceGroup.resources.map(function(resource) { return getResourceData(resource); })
    };
    navGroups[resourceGroup.name] = rgData.resources.map(function(r) { return r.nav })
    apiDs.resourceGroups.push(rgData);
  })

  // console.log(JSON.stringify(navGroups, 0, 4));
  // console.log(JSON.stringify(apiDs));
  var host = '';

  input.metadata.forEach(function(m) {
    if (m.name === 'HOST') {
      host = m.value;
      if(host.charAt(host.length - 1) === '/') {
        host = host.substring(0, host.length - 1)
      }
    }
  });
  less.render(require('fs').readFileSync(__dirname + '/less/main.less').toString(), {})
  .then(function(output) {
    done(null, require('pug').renderFile(__dirname + '/pug/index.pug', { 
      navGroups: navGroups, 
      css: output.css, 
      apiDs: apiDs, 
      host: host, 
      waypoints: require('fs').readFileSync(__dirname + '/js/waypoints.js').toString()  
    }/*, function(err) { console.log(err)}*/));  
  }, function(err) {
    console.log(arguments)
    console.log(err, err.stack)
  })
  
};


function getResourceData(resource) {
  var id = join(resource.name, resource.uriTemplate);
  var resObj = resourceObject(resource.description);
  if (resObj && resObj.objects) {
    resource.description = resObj.description;
    resObj.objects.forEach(function(obj) {
      resource.actions.unshift(obj);
    });
  }
  var resourceData = {
    id: id,
    name: resource.name,
    description: processDescription(resource.description),
    uri: resource.uriTemplate,
    parameters: resource.parameters.map(function(p){ return processParameters(p); }),
    actions: resource.actions.map(function(action) { return getActionData(action, { resourceId: id, uri: resource.uriTemplate }); }),
  }

  resourceData.nav = {
    name: resource.name,
    id: resourceData.id,
    children: resourceData.actions.map(function(action) { return { name: action.name, id: action.id };} )
  };

  return resourceData;
}


function getActionData(action, options) {
  var description = processDescription(action.description);
  return {
    id: join(action.name, action.method, options.resourceId),
    name: action.name,
    description: description,
    method: action.method,
    attributes: action.attributes,
    parameters: action.parameters.map(function(p){ return processParameters(p); }),
    examples: action.examples.map(function(example) { 
      return getExampleData(example);
    }),
    curl: createCurl({
      method: action.method,
      uri: action.attributes && action.attributes.uriTemplate,
      attributes: description && description.attributes,
      request: action.examples 
        && action.examples.length 
        && action.examples[0].requests 
        && action.examples[0].requests.length 
        && action.examples[0].requests[0]
    })
  }
}

function getExampleData(example) {
  return {
    name: example.name,
    description: processDescription(example.description),
    requests: example.requests.map(function(request) { request.method = example.method;return getRequestData(request); }),
    responses: example.responses.map(function(response) { return getResponseData(response); })
  }
}

function getRequestData(request) {
  return {
    name: request.name,
    description: processDescription(request.description),
    headers: request.headers,
    body: request.body ? md.render('```json\n' + request.body + '\n```') : '',
  }
}

function getResponseData(response) {
  return {
    name: response.name,
    description: processDescription(response.description),
    headers: response.headers,
    body: response.body ? md.render('```json\n' + response.body + '\n```') : ''
  }
}


function createCurl(options) {
  var curl = 'curl -v -X';
  if (!options.method || !options.uri) return '';
  var url;
  if(options.uri){
    url = options.uri;
    if (options.attributes && options.attributes.length) {
      options.attributes.forEach(function(attr) {
        if(url.indexOf('{' + attr.name + '}') !== -1 && typeof attr.sample !== 'undefined') {
          url = url.replace('{' + attr.name + '}', attr.sample)
        }
      });
    }
  }

  curl += options.method;
  curl += ' ';
  if (options.request && options.request.headers) {
    options.request.headers.forEach(function(header) {
      curl += '-H ' + '"' + header.name + '":"' + header.value + '" '; 
    });
  }
  if (options.request && options.request.body) {
    curl += '-d ' + "'" + JSON.stringify(options.request.body) + "'"; 
  }

  curl += '{host}' + url;
  return curl;
}