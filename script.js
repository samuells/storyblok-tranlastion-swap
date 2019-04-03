const StoryblokClient = require('storyblok-js-client')


// Settings of script
let oauthToken = ""
let spaceId = "" // id of space where to swap content
let fromLang = "" // language from which will be copy content into default
let toLang = "" // language where will be copy content from default
let i18nComponentsFields = {} // translatable fields per page

if (process.argv.length === 6) {
  console.log()
  console.log('\x1b[31m%s\x1b[0m', 'Expected at least 4 argument - [ "oauthToken", "spaceId", "fromLang", "toLang" ]!');
  console.log()
  process.exit(1)
} else if(process.argv.indexOf('--token') > -1) {
  const oauthTokenIndex = process.argv.indexOf('--token')

  if (oauthTokenIndex > -1) {
    oauthToken = process.argv[oauthTokenIndex + 1]
    spaceId = process.argv[oauthTokenIndex + 2]
    fromLang = process.argv[oauthTokenIndex + 3]
    toLang = process.argv[oauthTokenIndex + 4]
  }
  process.exit(1)
}



// Initialize the client with the oauth token
const Storyblok = new StoryblokClient({
  oauthToken: '' // user Auth Token from Storyblok
})

const addTransKeyFromComponent = function(component) {
  // creates i18nComponentsFields
  const compName = component.name
  const compSchema = component.schema
  const compKeys = Object.keys(compSchema)
  let i18nKeys = []

  compKeys.map( key => {
    if (compSchema[key].translatable) {
      i18nKeys.push(key)
    }
  })

  i18nComponentsFields[compName] = i18nKeys

  console.log(`✅   got all i18n fields of ${compName}`)
}

const swapContentOnStories = function(page=1) {
  Storyblok.get(`spaces/${spaceId}/stories`, {
    page
  })
  .then(response => {
    response.data.stories.map(story => getStoryContent(story.id))

    if (response.total - response.perPage * page > 0) {
      swapContentOnStories(page + 1) // get all stories from Storyblok - response is paged!!
    }
  }).catch(error => {
    console.log(error)
  })
}

const getStoryContent = function(storyId) {
  Storyblok.get(`spaces/${spaceId}/stories/${storyId}`, {})
  .then(response => {
    swapContentOfStory(response.data.story.content)
    console.log(`✅   swapped content on ${response.data.story.name}`)
    updateStory(storyId, response.data.story)
  }).catch(error => {
    console.log(error)
  })
}

const swapContentOfStory = function(content) {
  const i18nContentKeys = i18nComponentsFields[content.component]
  const contentKeys = Object.keys(content)

  contentKeys.map(key => {
    if(i18nContentKeys && i18nContentKeys.includes(key)) {
      content[`${key}__i18n__${toLang}`] = content[key]
      // if no translation leave the default
      content[key] = content[`${key}__i18n__${fromLang}`] ? content[`${key}__i18n__${fromLang}`] : content[key]
    } else if (Array.isArray(content[key])) {
      content[key].map(component => swapContentOfStory(component))
    } else {
      // Do nothing - not i18n field
    }
  })
}

const updateStory = function(storyId, updatedStory) {
  Storyblok.put(`spaces/${spaceId}/stories/${storyId}`, {
    "story": updatedStory,
    "force_update": 1
  }).then(response => {
    console.log(`⬆️   successfully updated - [${response.data.story.name}] `)
  }).catch(error => {
    console.log(error)
  })
}

// Get schemas of all components
Storyblok.get(`spaces/${spaceId}/components`, {})
.then(response => {
  response.data.components.map(component => addTransKeyFromComponent(component))
  // After get of all translatable fields start content swapping
  swapContentOnStories(1)
}).catch(error => {
  console.log(error)
})
