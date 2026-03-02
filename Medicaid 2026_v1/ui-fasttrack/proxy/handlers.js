const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  attributeNamePrefix: "",
  allowBooleanAttributes: true
});

function xmlToJson(xml) {
  return parser.parse(xml);
}

function handleSearchRes(responseBuffer, proxyRes, req, res) {
  const response = responseBuffer.toString("utf8");
  const parsed = JSON.parse(response);

  if (parsed.results && Array.isArray(parsed.results)) {
    parsed.results.forEach((r) => {
      if (!r.extracted || !r.extracted.content || !Array.isArray(r.extracted.content)) return;
      r.extracted.content = r.extracted.content.map((content) => {
        if (typeof content === "string" && content.trim().startsWith("<")) {
          try {
            return xmlToJson(content);
          } catch (e) {
            return content;
          }
        }
        return content;
      });
    });
  }

  return JSON.stringify(parsed);
}

function handleDocumentsRes(responseBuffer, proxyRes, req, res) {
  const response = responseBuffer.toString("utf8");
  const contentType = (proxyRes.headers["content-type"] || "").toLowerCase();

  if (contentType.startsWith("application/xml") || contentType.startsWith("text/xml")) {
    res.setHeader("content-type", "application/json");
    return JSON.stringify(xmlToJson(response));
  }

  return response;
}

module.exports = {
  handleSearchRes,
  handleDocumentsRes
};
