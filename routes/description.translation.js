'use strict';

const _ = require('lodash');
const P = require('bluebird');
const preq = require('preq');
const util = require('../lib/util');
const lib = require('../lib/description.translation');

const router = util.router();
let app;

// Get stored RB summaries for the results.  For demo and testing only.  For production, emit
// $merge nodes and hydrate summaries in RB.
function hydrateSummaries(source, domain, candidates) {

    function getPageSummary(domain, title) {
        return preq.get(`https://${domain}/api/rest_v1/page/summary/${title}`);
    }

    return P.map(candidates, candidate => P.join(
        getPageSummary(`${source}.wikipedia.org`, candidate.source),
        getPageSummary(domain, candidate.target),
        (sourceSummary, targetSummary) => {
            return Object.assign(candidate, {
                source: sourceSummary.body,
                target: targetSummary.body
            });
        })
    ).then(P.all);
}

/**
 * GET /{source}{/n}
 * Gets summaries for Wikipedia pages for entities with a description in the source language,
 * but not the target language (where a linked Wikipedia page exists for both languages).
 * The request wiki is treated as the target language.
 * Note well that n is, perhaps counterintuitively, treated as an upper bound for the number of
 * results returned, in the event that the client has a use for more than one at a time.
 * Due to the probabalistic strategy employed here, the number of results may be smaller (even 0).
 */
router.get('/:source/:n?', (req, res) => {
    const source = req.params.source;
    return lib.recommend(app, req.params.domain, req.params.source)
    .then(candidates => hydrateSummaries(source, req.params.domain,
        _.sampleSize(candidates, req.params.n || 1))
    ).then(items => res.json({ items }));
});

module.exports = function(appObj) {

    app = appObj;

    return {
        path: '/description/translation',
        api_version: 1,
        router
    };

};
