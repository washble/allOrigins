const { got } = require('./http-client')
const iconv = require('iconv-lite')

module.exports = getPage

const DOMAIN_MAPPINGS = (process.env.DOMAIN_MAPPINGS || '')
  .split(',')
  .reduce((acc, mapping) => {
    if (mapping) {
      // Split by : but handle cases with and without port
      const parts = mapping.split(':')
      const domain = parts[0]
      const ip = parts[1]
      const port = parts.length > 2 ? parts[2] : null
      acc[domain] = { ip, port }
    }
    return acc
  }, {})

function getPage({ url, format, requestMethod, charset }) {
  const urlObj = new URL(url)

  // Check domain mappings
  const mapping = DOMAIN_MAPPINGS[urlObj.hostname]
  if (mapping) {
    console.log(
      `[Preview Service] Using domain mapping for ${urlObj.hostname}: ${
        mapping.ip
      }${mapping.port ? ':' + mapping.port : ''}`,
    )
    // Construct new URL using the mapping, only add port if it exists
    const mappedUrl = `http://${mapping.ip}${
      mapping.port ? ':' + mapping.port : ''
    }${urlObj.pathname}${urlObj.search}`
    url = mappedUrl
    console.log(`[Preview Service] Mapped URL: ${url}`)
  }

  if (format === 'info' || requestMethod === 'HEAD') {
    return getPageInfo(url)
  } else if (format === 'raw') {
    return getRawPage(url, requestMethod, charset)
  }

  return getPageContents(url, requestMethod, charset)
}

async function getPageInfo(url) {
  const { response, error } = await request(url, 'HEAD')
  if (error) return processError(error)

  return {
    url: url,
    content_type: response.headers['content-type'],
    content_length: +response.headers['content-length'] || -1,
    http_code: response.statusCode,
  }
}

async function getRawPage(url, requestMethod, charset) {
  console.log(`[getRawPage] ${url}`)
  const { content, response, error } = await request(
    url,
    requestMethod,
    true,
    charset,
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    content,
    contentType: response.headers['content-type'],
    contentLength,
  }
}

async function getPageContents(url, requestMethod, charset) {
  const { content, response, error } = await request(
    url,
    requestMethod,
    false,
    charset,
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    contents: content.toString(),
    status: {
      url: url,
      content_type: response.headers['content-type'],
      content_length: contentLength,
      http_code: response.statusCode,
    },
  }
}

async function request(url, requestMethod, raw = false, charset = null) {
  try {
    const options = {
      method: requestMethod,
      decompress: !raw,
    }

    const response = await got(url, options)
    if (options.method === 'HEAD') return { response }

    return processContent(response, charset)
  } catch (error) {
    return { error }
  }
}

async function processContent(response, charset) {
  const res = { response: response, content: response.body }
  if (charset && iconv.encodingExists(charset)) {
    res.content = iconv.decode(res.content, charset)
  }
  return res
}

async function processError(e) {
  const { response } = e
  if (!response) return { contents: null, status: { error: e } }

  const { url, statusCode: http_code, headers, body } = response
  const contentLength = Buffer.byteLength(body)

  return {
    contents: body.toString(),
    status: {
      url,
      http_code,
      content_type: headers['content-type'],
      content_length: contentLength,
    },
  }
}
