/*
 * European Variation Archive (EVA) - Open-access database of all types of genetic
 * variation data from all species
 *
 * Copyright 2014, 2015 EMBL - European Bioinformatics Institute
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var summary = {};
var files = [];
function EvaStudyView(args) {
    _.extend(this, Backbone.Events);
    this.id = Utils.genId("EVAStudyView");
    this.type = 'eva';
    this.projectId = 'PRJEB5473';
    _.extend(this, args);
    this.rendered = false;
    this.render();
}
EvaStudyView.prototype = {
    render: function () {
        var _this = this;
        var params = {};

        if (this.type === 'dgva') {
            var params = {structural: 'true'};
        }

        EvaManager.get({
            category: 'studies',
            resource: 'summary',
            query: this.projectId,
            params: params,
            async: false,
            success: function (response) {
                try {
                    summary = response.response[0].result;
                } catch (e) {
                    console.log(e);
                }
                _this._parseData();
            }
        });

        if (this.type === 'eva') {
            var studySpeciesList = '';
            EvaManager.get({
                category: 'meta/species',
                resource: 'list',
                async: false,
                success: function (response) {
                    try {
                        studySpeciesList = response.response[0].result;
                        console.log(studySpeciesList)
                    } catch (e) {
                        console.log(e);
                    }
                }
            });
            if (!_.isUndefined(_.findWhere(studySpeciesList, {taxonomyScientificName: summary[0].speciesScientificName}))) {
                var speciesCode = _.findWhere(studySpeciesList, {taxonomyScientificName: summary[0].speciesScientificName}).taxonomyCode + '_' + _.findWhere(studySpeciesList, {taxonomyScientificName: summary[0].speciesScientificName}).assemblyCode
                var filesParams = {species: speciesCode};
            }

            EvaManager.get({
                category: 'studies',
                resource: 'files',
                query: this.projectId,
                params: filesParams,
                async: false,
                success: function (response) {
                    try {
                        files = response.response[0].result;
                    } catch (e) {
                        console.log(e);
                    }
                    _this._parseData();
                }
            });
        }
    },
    _draw: function (data, content) {
        var _this = this;
        var el = document.querySelector("#" + this.target);
        el.innerHTML = '';
        var elDiv = document.createElement("div");
        $(elDiv).html(content);
        el.appendChild(elDiv);
        el.applyAuthorStyles = true;
    },
    _parseData: function (data) {
        var _this = this;
        var data = {};
        var divContent = '';
        if (_.isEmpty(summary) == false && this.type === 'eva') {
            data = {summaryData: summary, filesData: files }
            divContent = _this._createContent(data)
        } else if (_.isEmpty(summary) == false && this.type === 'dgva') {
            data = {summaryData: summary }
            divContent = _this._createContent(data)
        }
        _this._draw(data, divContent);

        var publications = this.getPublications(data.summaryData[0].publications);
        console.log(publications)
        var publicationsDiv = document.querySelector("#publication-section");
        publicationsDiv.innerHTML = publications;

    },
    _createContent: function (data) {
        var _this = this;

        if (_this.type === 'eva') {

            var taxonomyId = new Array();
            if (data.summaryData[0].taxonomyId) {
                for (i = 0; i < data.summaryData[0].taxonomyId.length; i++) {
                    var taxLink = 'http://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=' + data.summaryData[0].taxonomyId[i];
                    taxonomyId.push(['<a href="' + taxLink + '" target="_blank">' + data.summaryData[0].taxonomyId[i] + '</a>']);
                }
            }
            var projectURL;
            var ena_link = 'ENA:<a href="http://www.ebi.ac.uk/ena/data/view/' + data.summaryData[0].id + '" target="_blank">' + data.summaryData[0].id + '</a>';
            if (_.isUndefined(_this._getProjectUrl(data.summaryData[0].id))) {
                projectURL = ena_link;
            } else {
                projectURL = '<a href="' + _this._getProjectUrl(data.summaryData[0].id) + '" target="_blank">' + _this._getProjectUrl(data.summaryData[0].id) + '</a><br /><br />' + ena_link;
            }

            var _filesTable = '<div><h3>' + data.summaryData[0].name + '</h3>' +
                '<div class="row study-view-data"><div class="col-md-12"><div><h4>General Information</h4></div><table id="summaryTable" class="table table-bordered study-view-table">' +
                '<tr><td><b>Organism</b></td><td><span id="organism-span">' + data.summaryData[0].speciesCommonName + '</span></td></tr>' +
                '<tr><td><b>Scientific Name</b></td><td><span id="scientific-name-span">' + data.summaryData[0].speciesScientificName + '</span></td></tr>' +
                '<tr><td><b>Taxonomy ID</b></td><td><span id="taxonomy-id-span">' + taxonomyId.join() + '</span></td></tr>' +
                '<tr><td><b>Center</b></td><td><span id="center-span">' + data.summaryData[0].center + '</span></td></tr>' +
                '<tr><td><b>Material</b></td><td><span id="material-span">' + data.summaryData[0].material + '</span></td></tr>' +
                '<tr><td><b>Scope</b></td><td><span id="scope-span">' + data.summaryData[0].scope + '</span></td></tr>' +
                '<tr><td><b>Type</b></td><td><span id="type-span">' + data.summaryData[0].experimentType + '</span></td></tr>' +
                '<tr><td><b>Source Type</b></td><td><span id="source-type-span">' + data.summaryData[0].sourceType + '</span></td></tr>' +
                '<tr><td><b>Platform</b></td><td><span id="platform-span">' + data.summaryData[0].platform + '</span></td></tr>' +
                '<tr><td><b>Samples</b></td><td><span id="samples-span">' + data.summaryData[0].numSamples + '</span></td></tr>' +
                '<tr><td><b>Description</b></td><td><span id="description-span">' + data.summaryData[0].description + '</span></td></tr>' +
                '<tr><td><b>Resource</b></td><td><span id="resource-span">' + projectURL + '</div></td></tr>' +
                '<tr><td><b>Download</b></td><td><span id="download-span"><a href="ftp://ftp.ebi.ac.uk/pub/databases/eva/' + data.summaryData[0].id + '" target="_blank">FTP</a></div></td></tr>' +
                '<tr><td><span><b>Publications</b></span></td><td><span id="publication-section"></span></td></tr>' +
                '</table>'

            if (data.filesData.length > 0) {
                var fileNameArr = [];

                for (i = 0; i < data.filesData.length; i++) {
                    var fileName = files[i].fileName;
                    var regex = /_accessioned.vcf/g;
                    if (fileName.match(regex)) {
                        _.extend(data.filesData[i], {ftpId: fileName.replace(regex, ".vcf.gz")});
                        fileNameArr.push(fileName.replace(regex, ".vcf.gz"));
                    } else {
                        fileNameArr.push(fileName)
                    }
                }
                var fileNameList = fileNameArr.join(',');
                var ftpLink = {};
                EvaManager.get({
                    category: 'files',
                    resource: 'url',
                    query: fileNameList,
                    async: false,
                    success: function (response) {
                        try {
                            ftpLink = response.response;

                        } catch (e) {
                            console.log(e);
                        }
                    }
                });
                _filesTable += '<div><h4>Files</h4></div><table id="filesTable" class="table table-striped"><thead><tr>' +
                    '<th>File Name</th>' +
                    '<th>Samples with Genotypes</th>' +
                    '<th>Variants Count</th>' +
                    '<th>SNP Count</th>' +
                    '<th>Indel Count</th>' +
                    '<th>Pass Count</th>' +
                    '<th>Transitions/Transversions Ratio</th>' +
                    '<th>Mean Quality</th>' +
                    '<th>View</th>' +
                    '</tr></thead><tbody>'
                for (i = 0; i < data.filesData.length; i++) {
                    var ftpLocation = '';
                    if (!_.isUndefined(_.findWhere(ftpLink, {id: data.filesData[i].fileName}))) {
                        ftpLocation = _.findWhere(ftpLink, {id: data.filesData[i].fileName}).result[0];
                    }
                    var iobioLink = 'NA';
                    if (ftpLink.length > 0 && ftpLocation != 'ftp:/null' && !_.isEmpty(ftpLocation)) {
                        console.log(ftpLocation)
                        var downloadLink = '<a href="' + ftpLocation + '" target="_blank">' + data.filesData[i].fileName + '</a>';
                        iobio_url = 'http://ega-beacon.windows.ebi.ac.uk:8080/?vcf=' + ftpLocation;
                        iobioLink = '<a href="?eva-iobio&url=' + iobio_url + '" target="_blank">Iobio</a>'
                    } else {
                        var downloadLink = data.filesData[i].fileName;
                    }
                    var samples_count;
                    var variantsCount;
                    var snpsCount;
                    var indelsCount;
                    var passCount;
                    var transitionsCount;
                    var meanQuality;
                    if (!_.isUndefined(data.filesData[i].stats) && !_.isNull(data.filesData[i].stats)) {
                        if (data.filesData[i].stats.samplesCount) {
                            samples_count = data.filesData[i].stats.samplesCount;
                        } else {
                            samples_count = 'NA';
                        }
                        variantsCount = data.filesData[i].stats.variantsCount;
                        snpsCount = data.filesData[i].stats.snpsCount;
                        indelsCount = data.filesData[i].stats.indelsCount;
                        passCount = data.filesData[i].stats.passCount;
                        transitionsCount = (data.filesData[i].stats.transitionsCount / data.filesData[i].stats.transversionsCount).toFixed(2) + '&nbsp;(' + data.filesData[i].stats.transitionsCount + '/' + data.filesData[i].stats.transversionsCount + ')';
                        meanQuality = data.filesData[i].stats.meanQuality.toFixed(2);
                    } else {
                        samples_count = 'NA';
                        variantsCount = 'NA';
                        snpsCount = 'NA';
                        indelsCount = 'NA';
                        passCount = 'NA';
                        transitionsCount = 'NA';
                        meanQuality = 'NA';
                    }

                    _filesTable += '<tr>' +
                        '<td class="link">' + downloadLink + '</td>' +
                        '<td><span class="samples_count">' + samples_count + '</span></td>' +
                        '<td><span class="variants_ount">' + variantsCount + '</span></td>' +
                        '<td><span class="snps_count">' + snpsCount + '</span></td>' +
                        '<td><span class="indels_count">' + indelsCount + '</span></td>' +
                        '<td><span class="pass_count">' + passCount + '</span></td>' +
                        '<td><span class="transition_count">' + transitionsCount + '</span></td>' +
                        '<td><span class="mean_count">' + meanQuality + '</span></td>' +
                        '<td><span class="iobio_link">' + iobioLink + '</span></td>' +
                        '</tr>'
                }
                _filesTable += '</tbody></table>'

            }
            _filesTable += '</div></div>'
        }
        else if (_this.type === 'dgva') {
            var taxonomyId = new Array();

            if (data.summaryData[0].taxonomyId) {
                for (i = 0; i < data.summaryData[0].taxonomyId.length; i++) {
                    var taxLink = 'http://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=' + data.summaryData[0].taxonomyId[i];
                    taxonomyId.push(['<a href="' + taxLink + '" target="_blank">' + data.summaryData[0].taxonomyId[i] + '</a>']);
                }
            }

            var _filesTable = '<div><h3>' + data.summaryData[0].name + '</h3>' +
                '<div class="row study-view-data"><div class="col-md-12"><div><h4>General Information</h4></div><table id="summaryTable" class="table table-bordered">' +
                '<tr><td><b>Organism</b></td><td class="eva-capitalize"><span id="organism-span">' + data.summaryData[0].speciesCommonName + '</span></td></tr>' +
                '<tr><td><b>Scientific Name</b></td><td><span id="scientific-name-span">' + data.summaryData[0].speciesScientificName + '</span></td></tr>' +
                '<tr><td><b>Taxonomy ID</b></td><td><span id="taxonomy-id-span">' + taxonomyId.join() + '</span></td></tr>' +
                '<tr><td><b>Study Type</b></td><td><span id="study-type-span">' + data.summaryData[0].typeName + '</span></td></tr>' +
                '<tr><td><b>Experiment Type</b></td><td><span id="exp-type-span">' + data.summaryData[0].experimentType + '</span></td></tr>' +
                '<tr><td><b>Platform</b></td><td><span id="platform-span">' + data.summaryData[0].platform + '</span></td></tr>' +
                '<tr><td><b>Assembly</b></td><td><span id="assembly-span">' + data.summaryData[0].assembly + '</span></td></tr>' +
                '<tr><td><b>Variants</b></td><td><span id="variants-span">' + data.summaryData[0].numVariants + '</span></td></tr>' +
                '<tr><td><b>Description</b></td><td><span id="description-span">' + data.summaryData[0].description + '</span></td></tr>' +
                '<tr><td><b>Download</b></td><td><span id="download-span"><a href="ftp://ftp.ebi.ac.uk/pub/databases/dgva/' + data.summaryData[0].id + '_' + data.summaryData[0].name + '" target="_blank">FTP</a></span></td></tr>' +
                '<tr><td><span><b>Publications</b></span></td><td><span id="publication-section"></span></td></tr>'
            '</table></div></div>'

        }

        return _filesTable;
    },
    _getProjectUrl: function (data) {
        var _this = this;
        for (var i = 0; i < projects.length; i++) {
            if (projects[i].id === data) {
                return projects[i].url;
            }
        }
    },
    getPublications: function (data) {

        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open('POST', 'https://somesoapurl.com/', true);
        // Iterate over PubMed ID's (if any) and get publication from citeXplorer
        var paper_output = '';
        for (i = 0; i < data.length; i++) {
            var pubmedId = data[i];
            var pubDiv = document.querySelector("#publication-section");
            console.log(pubDiv)
            if (pubDiv) {
                pubDiv.innerHTML = '<p>Attempting to retrieve publication information for PubMed ID <a class="external publication" href="http://europepmc.org/abstract/MED/' + pubmedId + '">' + pubmedId + '...</p>'
            }
            if (pubmedId && pubmedId != '-') {
                var id_type = 'PubMed';
                // Make the actual AJAX call...
                var host = METADATA_HOST.replace("/eva/webservices/rest", "");
                var url = host + '/ega/publications/get/paper/' + id_type + '/' + pubmedId;
                if (window.location.protocol != 'https:') {
                    url = url.replace("http", "https");
                }
                $.ajax({
                    type: 'GET',
                    url: url,
                    dataType: "json",
                    async: false,
                    success: function (response) {
                        if (response.data['title']) {
                            var title = response.data['title'];
                            var authors = response.data['authors'];
                            var firstAuthor = response.data['first-author'];
                            var journal = response.data['journal'];
                            var volume = response.data['volume'];
                            var year = response.data['year'];
                            var pages = response.data['pages'];
                            var pmid = response.data['pmid'];
                            var doi = response.data['doi'];
                            var isbn = response.data['isbn'];

                            paper_output += '<p class="publications"><a class="external publication" href="http://europepmc.org/abstract/MED/' + pmid + '">' + title + '</a><br />'

                            if (authors.length > 180) {
                                paper_output += firstAuthor + '<br />';
                            } else {
                                paper_output += authors + '<br />';
                            }

                            paper_output += '<em>' + journal + '</em> <strong>' + volume + '</strong>:' + year + ' ' + pages + '</p>';
                        }

                    },
                    error: function (x, y, z) {
                        pubDiv.innerHTML = '<p>Publication Information for PubMed ID <a class="external publication" href="http://europepmc.org/abstract/MED/' + pubmedId + '">' + pubmedId + '</a> could not be retrieved at this time.</p>';
                        // x.responseText should have what's wrong
                    }
                });
            }
        }

        var value = '-';
        if (paper_output) {
            value = paper_output;
        }

        return value;
    }

}


