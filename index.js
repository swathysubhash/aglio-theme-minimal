
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
    // This is a list of all supported API Blueprint format versions
    formats: ['1A'],
    // This is a list of all options your theme accepts. See
    // here for more: https://github.com/bcoe/yargs#readme
    // Note: These get prefixed with `theme` when you access
    // them in the options object later!
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
  // Normally you would use some template engine here.
  // To keep this code really simple, we just print
  // out a string and ignore the API Blueprint.
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
    actions: resource.actions.map(function(action) { return getActionData(action, id); }),
  }

  resourceData.nav = {
    name: resource.name,
    id: resourceData.id,
    children: resourceData.actions.map(function(action) { return { name: action.name, id: action.id };} )
  };

  return resourceData;
}


function getActionData(action, resourceId) {
  return {
    id: join(action.name, action.method, resourceId),
    name: action.name,
    description: processDescription(action.description),
    method: action.method,
    parameters: action.parameters.map(function(p){ return processParameters(p); }),
    examples: action.examples.map(function(example) { return getExampleData(example); })
  }
}

function getExampleData(example) {
  return {
    name: example.name,
    description: processDescription(example.description),
    requests: example.requests.map(function(request) { return getRequestData(request); }),
    responses: example.responses.map(function(response) { return getResponseData(response); })
  }
}

function getRequestData(request) {
  return {
    name: request.name,
    description: processDescription(request.description),
    headers: request.headers,
    body: request.body ? md.render('```json\n' + request.body + '\n```') : ''
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