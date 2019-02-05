'use strict';

const preq = require('preq');
const api = require('./api-util');

/**
 * Calls the WDQS API with the supplied query in its body
 * TODO: Move to api-util
 * @param {Object} app the application object
 * @param {string} query the sparql query to run
 * @return {Promise} a promise resolving as the response object from the MW API
 */
function wdqsApiGet(app, query) {
    const request = app.wdqsapi_tpl.expand({
        request: {
            headers: { 'user-agent': app.conf.user_agent },
            query
        }
    });

    return preq(request);
}

function queryRandomPages(app, domain) {
    return api.mwApiGet(app, domain, {
        action: 'query',
        formatversion: 2,
        generator: 'random',
        prop: 'pageprops|description',
        redirects: 1,
        grnnamespace: 0,
        grnlimit: 500
    }).then(rsp => rsp.body.query.pages);
}

function filterRandomPages(pp) {
    return pp.filter(p => p.pageprops
        && p.description
        && !p.pageprops.disambiguation
        && p.pageprops.wikibase_item);
}

function sanitizeTitle(title) {
    return encodeURIComponent(title.replace(/ /g, '_'));
}

function queryForItemsWithLocalDescriptions(app, domain, titles) {
    return api.mwApiGet(app, domain, {
        action: 'query',
        formatversion: 2,
        prop: 'description|pageprops',
        titles: titles.join('|')
    }).then((rsp) => {
        return rsp.body.query && rsp.body.query.pages
        .filter(p => p.description)
        .map(p => p.pageprops.wikibase_item);
    });
}

/**
 * Run one (or, when targeting enwiki, two) follow-up queries to filter out entities that already
 * have descriptions in the target language. The first query, to filter out items with descriptions
 * in Wikidata, is run for all languages in WDQS. When targeting enwiki, it is also necessary to
 * perform a follow-up Action API query to ensure that there are no remaining candidates with local
 * descriptions.
 * @param {!Application} app the application object
 * @param {!string} source source lang code
 * @param {!string} domain the request domain (the first segment of which is the target lang code)
 * @param {!object[]} pp list of candidate pages
 */
function filterMissingDescInTarget(app, source, domain, pp) {

    const target = domain.split('.')[0];

    const srcTitleLookup = pp.reduce((acc, cur) => {
        acc[cur.pageprops.wikibase_item] = cur.title;
        return acc;
    }, {});

    const query = `SELECT ?item ?sitelink WHERE {
                     VALUES ?item { ${pp.map(p => `wd:${p.pageprops.wikibase_item}`).join(' ')} }
                     FILTER EXISTS {
                        ?article schema:about ?item .
                        ?article schema:isPartOf <https://${domain}/> .
                     }
                     FILTER(NOT EXISTS {
                        ?item schema:description ?itemdesc .
                        FILTER(LANG(?itemdesc) = "${target}")
                     })
                     ?sitelink schema:about ?item .
                     ?sitelink schema:isPartOf <https://${target}.wikipedia.org/> .
                   }`;

    function resultFromBinding(item) {
        return {
            source: sanitizeTitle(srcTitleLookup[item.item.value.split('/').pop()]),
            target: item.sitelink.value.split('/').pop(),
        };
    }

    return wdqsApiGet(app, query)
    .then((response) => {
        const bindings = response.body.results.bindings;
        if (target === 'en') {
            const rawTitles = bindings.map(b => b.sitelink.value.split('/').pop());
            return queryForItemsWithLocalDescriptions(app, domain, rawTitles)
            .then(rsp => bindings.filter((item) => {
                return !(rsp || []).includes(item.item.value.split('/').pop());
            }).map(resultFromBinding));
        } else {
            return bindings.map(resultFromBinding);
        }
    });
}

function recommend(app, domain, source) {
    return queryRandomPages(app, `${source}.wikipedia.org`)
    .then(filterRandomPages)
    .then(pp => filterMissingDescInTarget(app, source, domain, pp));
}

module.exports = { recommend };
