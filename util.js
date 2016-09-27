var MarkdownIt = require('markdown-it');
var hljs = require('highlight.js');

var slugCache = {
  _nav : []
}

var md = require('markdown-it')({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(lang, str, true).value +
               '</code></pre>';
      } catch (__) {}
    }
 
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
}).use(require('markdown-it-anchor'), {
  slugify: function(value) {
    output = "header-" + slug(slugCache, value, true);
    slugCache._nav.push({ name: value, id: output });
    return output;
  }
})
.use(require('markdown-it-checkbox'))
.use(require('markdown-it-container'));


function slug(cache, value, unique) {
  var sluggified = value.toLowerCase()
                    .replace(/[ \t\n\\<>"'=:/]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-/, '')
  if(unique)
    while(cache[sluggified])
      if(sluggified.match(/\d+$/))
        sluggified = sluggified.replace(/\d+$/, function(value) {
          return parseInt(value) + 1
        });
      else
        sluggified = sluggified + '-1'
  cache[sluggified] = true;
  return sluggified
}

function join() {
  return Array.prototype.slice.call(arguments).map(function(a) {
    return a.toLowerCase()
                    .replace(/[ \t\n\\<>"'=:/]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-/, '')
  }).join('-');
}


function createChildren(splits) {
	var root = {};
	var rootP = root;

	splits.forEach(function(split) {
		split = split.trim();
		if (split === '#CHILD') {
			if (rootP.children) {
				if (!rootP.children.length) rootP.children.push({});
				var last = rootP.children[rootP.children.length - 1];
				last.parent = rootP;
				rootP = last;
			}
		} else if (split === '#ENDCHILD') {
			var tempChild = rootP;
			rootP = rootP.parent;
			delete tempChild.parent;
		} else {
			if (!rootP.children) rootP.children = [];
			rootP.children.push(processLine(split));
		}
	})
	
	return root.children
}

function processLine(line) {
	var name =  '', type = '', description = '', sample = '';
	line = line.replace(/\s\s+/g, ' ').replace('+', '').trim();
	var splits = line.split('-')
	if (splits.length > 1) {
		description = splits[1].trim()
	} 

	if (splits[0]) {
		splits = splits[0].trim().split(':')
		name = splits[0].trim();
		sample = splits[1] && splits[1].substring(0, splits[1].indexOf('(')).trim()
		type = splits[1] && splits[1].replace(sample, '').replace('(', '').replace(')', '').trim()
	}

	return {
		name: name,
		type: type,
		description: description,
		sample: sample
	}
}

function processParameters(parameter) {
	var description = parameter.description;
	if (!description || 
		description.indexOf('#CHILD')=== -1 || 
		description.indexOf('#ENDCHILD') === -1) {
		return parameter;
	}

	if (description.match(/#CHILD/g).length !== description.match(/#ENDCHILD/g).length) {
		console.error('CHILD and ENDCHILD not added correctly for parameter description', description)
		return parameter;
	}

	var childText = description.substring(description.indexOf('#CHILD'), description.lastIndexOf('#ENDCHILD') + 9);
	parameter.description = description.replace(childText, '');
	var splits = childText.split('\n');
	parameter.children = createChildren(splits);
	return parameter;
}


function processDescription(description) {
	var attributesPresent = description.indexOf('#ATTRIBUTES') !== -1;
	var attributes = [];
	if (attributesPresent) {
		if (description.indexOf('#ENDATTRIBUTES') === -1) {
			console.error('ENDATTRIBUTES is missing for ATTRIBUTES specified')
		}
		var attributesText = description.substring(description.indexOf('#ATTRIBUTES'), description.indexOf('#ENDATTRIBUTES') + 14)
		description = description.replace(attributesText, '')
		attributesText = attributesText.split('\n');
		var childText = '';
		var childCount = 0;
		attributesText.forEach(function(attr) {
			attr = attr.trim();
			if (attr !== '#ATTRIBUTES' && attr !== '#ENDATTRIBUTES') {
				if (attr.charAt(0) === '+' && childCount === 0) {
					if (childText && attributes.length) {
						attributes[attributes.length - 1].description += childText + '\n';
						childText = ''
					}
					var newAttr = processLine(attr);
					attributes.push(newAttr);
				} else {
					childText += attr + '\n';
					if (attr === '#CHILD') {
						childCount++;
					} else if (attr === '#ENDCHILD') {
						childCount--;
					}
				}
			}
		});
		if(childText && attributes.length) {
			attributes[attributes.length - 1].description += childText + '\n';
			childText = ''
		}
		attributes = attributes.map(function(attr){ return processParameters(attr)});
	}

	var rhs = ''
	var rhsPresent = description.indexOf('#RHS') !== -1;
	if (rhsPresent) {
		if (description.indexOf('#ENDRHS') === -1) {
			console.error('ENDRHS is missing for every RHS specified')
		}
		var rhsText = description.substring(description.indexOf('#RHS'), description.indexOf('#ENDRHS') + 7)
		description = description.replace(rhsText, '')
		rhs = rhsText.replace('#RHS', '').replace('#ENDRHS', '')
	}

	return {
		html: md.render(description),
		rhs: md.render(rhs),
		attributes: attributes
	}
}

function resourceObject(description) {
	if (!description) {
		return;
	}
	var objectPresent = description.indexOf('# OBJECT') !== -1;
	if (!objectPresent) {
		return {
			description: description
		};
	}
	var objectText  = description.substring(description.indexOf('# OBJECT'));
	description = description.replace(objectText, '')

	var objects = [];
	objectText = objectText.split('# OBJECT');

	objectText.forEach(function(ot) {
		ot = ot.trim();
		if(ot) {
			objects.push({
				name: ot.substring(0, ot.indexOf('\n')).trim() + ' Object',
				description: ot.substring(ot.indexOf('\n')),
				parameters: [],
				method: '',
				examples: []
			})
		}
	})

	return {
		description: description,
		objects: objects

	}
}


module.exports = {
	join: join,
	slugCache: slugCache,
	slug: slug,
	processParameters: processParameters,
	processDescription: processDescription,
	resourceObject: resourceObject,
	md: md
}