-- Tables for storing normalized ranks of potential pageviews for a given
-- Wikidata Q identification.
-- See https://github.com/wikimedia/research-translation-recommendation-predictions

-- List of Wikipedia languages
-- You can import data from https://github.com/wikimedia/research-translation-recommendation-models/blob/master/wikipedia.langlist
CREATE TABLE `language` (
  `id` smallint(6) NOT NULL AUTO_INCREMENT,
  `code` varchar(8) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB;

CREATE TABLE `article_recommendation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `wikidata_id` int(11) NOT NULL,
  `score` float NOT NULL,
  `source_id` smallint(6) NOT NULL,
  `target_id` smallint(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `wikidata_id` (`wikidata_id`),
  KEY `source_id` (`source_id`),
  KEY `target_id` (`target_id`),
  CONSTRAINT `article_recommendation_ibfk_1` FOREIGN KEY (`source_id`) REFERENCES `language` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `article_recommendation_ibfk_2` FOREIGN KEY (`target_id`) REFERENCES `language` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
