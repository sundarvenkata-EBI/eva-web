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
function EvaVariantView(args) {
    _.extend(this, Backbone.Events);
    this.id = Utils.genId("EVAVariantView");
    _.extend(this, args);
    this.rendered = false;
    this.render();
}
EvaVariantView.prototype = {
    getVariantTypeSOLink: function(variantType) {
        if (variantType) {
            variantType = variantType.toUpperCase();
            if (variantType in VARIANT_TYPE_SO_MAP) {
                return '<a href="' + SO_SERVICE + "/" + VARIANT_TYPE_SO_MAP[variantType] + '" target="_blank">'
                            + variantType + '</a>';
            }
            return variantType;
        }
        return '';
    },

    getAssemblyLink: function(assembly) {
        if (assembly) {
            assembly = assembly.toUpperCase();
            var assemblyLookupService = "";
            if (assembly.startsWith("GCA")) {
                assemblyLookupService = ENA_ASSEMBLY_LOOKUP_SERVICE;
            } else if (assembly.startsWith("GCF")) {
                assemblyLookupService = NCBI_ASSEMBLY_LOOKUP_SERVICE;
            }
            if (assemblyLookupService) {
                return '<a href="' + assemblyLookupService + "/" + assembly + '" target="_blank">' + assembly + '</a>';
            }
        }
        return '';
    },

    isValidResponse: function(response) {
        return (typeof response !== 'undefined' && response != null && !_.isEmpty(response));
    },

    getAccessioningWebServiceResponse: function(accessionCategory, accessionResource, errorHandler) {
        return EvaManager.get({
            service: ACCESSIONING_SERVICE,
            category: accessionCategory,
            resource: accessionResource,
            async: false,
            error: errorHandler
        });
    },

    // Get the list of studies pertinent to the current species
    getStudiesList: function(species) {
        // Get studies list
        var response = EvaManager.get({
            category: 'meta/studies',
            resource: 'list',
            params: {species: species},
            async: false
        });

        try {
            if (this.isValidResponse(response)) {
                var _tempStudies = response.response[0].result;
                return _.map(_.keys(_tempStudies), function (key) {
                    if(_.indexOf(DISABLE_STUDY_LINK, this[key].studyId) > -1){
                        this[key].link = false;
                    } else {
                        this[key].link = true;
                    }
                    return this[key];
                }, _tempStudies);
            } else {
                return [];
            }

        } catch (e) {
            console.log(e);
            return [];
        }
    },

    // For a given RS ID, get associated SS ID
    getAssociatedSSIDsFromAccessioningService: function(accessionCategory, accessionID) {
         return this.getAccessioningWebServiceResponse(accessionCategory, accessionID.substring(2) + "/submitted");
    },

    // Calculate end coordinate for a variant given start, ref and alt
    getVariantEndCoordinate: function(variantStartCoordinate, referenceAllele, alternateAllele) {
        return variantStartCoordinate + Math.max(referenceAllele.length, alternateAllele.length) - 1;
    },

    // Get formatted date from a JSON date
    getFormattedDate: function(dateValue) {
        if (dateValue) {
            var dateObj = new Date(dateValue);
            var monthNames = ["January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"
            ];
            return dateObj.getDate() + " " + monthNames[dateObj.getMonth()] + " " +
                                        dateObj.getFullYear();
        }
        return '';
    },

    addAssociatedSSID: function(ssIDKey, ssIDAttributes) {
        if (ssIDKey in this.associatedSSIDs) {
            this.associatedSSIDs[ssIDKey].Alternate =
                _.uniq(this.associatedSSIDs[ssIDKey].Alternate.concat(ssIDAttributes.Alternate));
            this.associatedSSIDs[ssIDKey].Alternate.sort();
        } else {
            this.associatedSSIDs[ssIDKey] = ssIDAttributes;
        }
    },

    // Add variant representation in the form of Ref/Alt ex: A/T
    addReprToVariantObj: function(variantObj) {
        var getAlleleRepr = function(allele) {
            return (allele === ''? '-':allele);
        };
        if (typeof(variantObj.alternate) !== "undefined") {
            variantObj.referenceRepr = getAlleleRepr(variantObj.reference);
            variantObj.alternateRepr = getAlleleRepr(variantObj.alternate);
            variantObj.repr = variantObj.referenceRepr + "/" + variantObj.alternateRepr;
        }
    },

    // Given the species list and the current species, get the current assembly
    getCurrentAssembly: function(selectedSpecies, speciesList) {
        return _.chain(speciesList)
            .filter(function(speciesAttr) {
                return ((speciesAttr.taxonomyCode + "_" + speciesAttr.assemblyCode) === selectedSpecies);
            }).value()[0].assemblyAccession;
    },

    getStudyTitle: function(projectAccession) {
        var response = EvaManager.get({
            category: 'studies',
            resource: 'summary',
            query: projectAccession,
            params: {},
            async: false
        });
        if (this.isValidResponse(response)) {
            return response.response[0].result[0].name;
        }
        return "";
    },

    getProjectAccessionAnchor: function (projectAccession) {
        if (projectAccession) {
            if(projectAccession.trim().startsWith("PRJEB") || projectAccession.trim().startsWith("PRJNA")) {
                var studyTitle = this.getStudyTitle(projectAccession);
                return '<a href="?eva-study=' + projectAccession + '" target="_blank" ' +
                        (studyTitle ? 'title="' + studyTitle + '"' : '') + '>' + projectAccession + '</a>';
            }
            return projectAccession;
        }
        return '';
    },

    getProjectAccessionAnchorForSSID: function(ssID) {
        var response = this.getAccessioningWebServiceResponse("submitted-variants", ssID.substring(2));
        if (this.isValidResponse(response)) {
            return this.getProjectAccessionAnchor(response[0].data.projectAccession);
        }
        return '';
    },

    deprecatedVariantHandler: function(jqXHR, textStatus, errorThrown) {
        if (jqXHR.status === 410) {
            console.log('Handling a deprecated variant');
            this.deprecatedVariantInfo = jqXHR.responseJSON;
            this.variantIsDeprecated = true;
        }
    },

    // Given the accession category, use the accessioning web service to construct a variant object
    getVariantInfoFromAccessioningService: function(selectedSpecies, speciesList, accessionCategory, accessionID) {
        var _this = this;
        // Get variant type given an RS ID
        function getVariantTypeFromRSID (rsID) {
            var response = _this.getAccessioningWebServiceResponse("clustered-variants", rsID.substring(2));
            if (_this.isValidResponse(response)) {
                return response[0].data.type;
            }
            return '';
        }

        // Check if two assemblies are equivalent.
        // TODO: This is a crude and rudimentary check until a better approach to determine assembly synonyms comes along
        // For some species like Arabidopsis the equivalent assemblies in GCF and GCA could have different versions
        function areAssembliesEquivalent (assemblyAccession1, assemblyAccession2) {
            if (assemblyAccession1 && assemblyAccession2) {
                var accession1 = assemblyAccession1.trim().toUpperCase();
                var accession2 = assemblyAccession2.trim().toUpperCase();
                return (accession1 === accession2
                        || (accession1 in ASSEMBLY_GCA_TO_GCF_SYNONYMS
                            && ASSEMBLY_GCA_TO_GCF_SYNONYMS[accession1] === accession2)
                        || (accession1 in ASSEMBLY_GCF_TO_GCA_SYNONYMS
                            && ASSEMBLY_GCF_TO_GCA_SYNONYMS[accession1] === accession2));
            }
            return false;
        }

        // Use attributes from Accessioning web service response to construct a variant object
        function mapAccessioningServiceResponseToVariantInfo(response) {
            var variantInfo = {};
            var taxonomyIdFromAccessioningService = response.data.taxonomyAccession;
            var assemblyFromAccessioningService = (accessionCategory === "submitted-variants" ?
                                                response.data.referenceSequenceAccession : response.data.assemblyAccession);
            if (!_.isEmpty(speciesList) && typeof taxonomyIdFromAccessioningService !== 'undefined') {
                var speciesObj = _.chain(speciesList)
                            .filter(function(speciesAttr) {
                                return (speciesAttr.taxonomyId === taxonomyIdFromAccessioningService &&
                                        areAssembliesEquivalent(speciesAttr.assemblyAccession, assemblyFromAccessioningService));
                            }).value()[0];
                variantInfo.species = speciesObj.taxonomyCode + "_" + speciesObj.assemblyCode;
                // Do NOT proceed if the variant's species + assembly combination does not match
                // the species dropdown of the search UI
                if (variantInfo.species !== selectedSpecies) {
                    return;
                }
                variantInfo.assemblyAccession = assemblyFromAccessioningService;
                variantInfo.projectAccession = response.data.projectAccession;
                variantInfo.submitterHandle = _this.getProjectAccessionAnchor(variantInfo.projectAccession);
                variantInfo.chromosome = response.data.contig;
                variantInfo.start = response.data.start;
                variantInfo.reference = response.data.referenceAllele;
                if (response.data.alternateAllele) {
                    variantInfo.alternate = response.data.alternateAllele;
                    variantInfo.end = _this.getVariantEndCoordinate(variantInfo.start, response.data.referenceAllele,
                                                                response.data.alternateAllele);
                    variantInfo.associatedRSID = response.data.clusteredVariantAccession;
                    variantInfo.associatedRSID = variantInfo.associatedRSID ? "rs" + variantInfo.associatedRSID : '';
                }

                var booleanOrNullToYesNoEmpty = function(booleanValue) {
                    if (booleanValue === true) {
                        return "Yes";
                    } else if (booleanValue === false) {
                        return "No";
                    }
                    return "";
                };
                variantInfo.evidence = booleanOrNullToYesNoEmpty(response.data.supportedByEvidence);
                variantInfo.assemblyMatch = booleanOrNullToYesNoEmpty(response.data.assemblyMatch);
                variantInfo.allelesMatch = booleanOrNullToYesNoEmpty(response.data.allelesMatch);
                variantInfo.validated = booleanOrNullToYesNoEmpty(response.data.validated);
                variantInfo.createdDate = _this.getFormattedDate(response.data.createdDate);
                if (accessionCategory === "clustered-variants") {
                    variantInfo.id = "rs" + response.accession;
                    variantInfo.type = response.data.type;
                }
                if (accessionCategory === "submitted-variants") {
                    variantInfo.id = "ss" + response.accession;
                    variantInfo.type = variantInfo.associatedRSID ? getVariantTypeFromRSID(variantInfo.associatedRSID):'';
                }
                variantInfo.variantTypeLink = _this.getVariantTypeSOLink(variantInfo.type);
                return variantInfo;
            }
        }

        // Get response from the accessioning web service
        this.deprecatedVariantInfo = null;
        var response = this.getAccessioningWebServiceResponse(
            accessionCategory, accessionID.substring(2), this.deprecatedVariantHandler.bind(this));
        if (this.deprecatedVariantInfo !== null) {response = this.deprecatedVariantInfo}

        try {
            if (this.isValidResponse(response)) {
                return _.map(response, mapAccessioningServiceResponseToVariantInfo);
            } else {
                return [];
            }
        } catch (e) {
            console.log(e);
        }
    },

    // Given a position or ssID, use the EVA web service to construct a variant object
    getVariantInfoFromEVAService : function(attributeToSearchBy, queryParams) {
        var webServiceResponse = EvaManager.get({
            category: 'variants',
            resource: 'info',
            query: attributeToSearchBy,
            params: queryParams,
            async: false
        });
        try {
            var _this = this;
            var results = webServiceResponse.response[0].result;
            if (this.isValidResponse(results)) {
                results.forEach(function(result) {
                    //Work around https://www.ebi.ac.uk/panda/jira/browse/EVA-1398
                    if (typeof(result.alternate) === "undefined") { result.alternate = ""; }
                    if (typeof(result.reference) === "undefined") { result.reference = ""; }

                    _this.addReprToVariantObj(result);
                    if (result.ids) {
                        result.associatedRSID = result.ids.filter(function(x) {return x.startsWith("rs");})[0];
                        result.associatedSSIDs = result.ids.filter(function(x) {return x.startsWith("ss");});
                    }
                    result.allAlternates = _.uniq([result.alternate].concat(
                                                    _.chain(result.sourceEntries).values().map(function(sourceEntry) {
                                                        return (sourceEntry.secondaryAlternates ?
                                                                    sourceEntry.secondaryAlternates : []);
                                                    }).flatten().value()
                                            ));
                    result.evidence = "Yes";
                    if (attributeToSearchBy.startsWith("rs") || attributeToSearchBy.startsWith("ss")) {
                        result.id = attributeToSearchBy;
                    } else {
                        if (result.associatedSSIDs) {
                            result.associatedSSIDs.forEach(function(ssID){
                                _this.addAssociatedSSID(ssID + "_" + result.chromosome , {"ID": ssID});});
                            result.id = result.associatedSSIDs.join(",");
                        } else {
                            result.id = [result.chromosome, result.start, result.reference, result.alternate].join(":");
                        }
                    }
                });
                return results;
            } else {
                return [];
            }
        }
        catch (e) {
            console.log(e);
            return [];
        }
    },

    // Test variant objects from the EVA and accessioning service
    areVariantObjectsComparable: function (variantObj1, variantObj2) {
        // This can fail in a rare scenario for species like cow where one ssID maps to variants in more than 1 chromosome
        // variant1 = chr1:300:T:A with ssID1
        // variant2 = chr2:300:T:A with ssID1
        // TODO: For the sake of correctness, this should include chromosome comparison as well
        // but can't be done now because EVA and accessioning service have different chromosome representations
        // This should be re-visited during https://www.ebi.ac.uk/panda/jira/browse/EVA-432
        return (variantObj1.start === variantObj2.start && variantObj1.reference === variantObj2.reference &&
                    variantObj1.alternate === variantObj2.alternate);
    },

    // Process a query based on accession ID
    processQueryWithAccessioningService: function () {
        var _this = this;
        this.variant = this.getVariantInfoFromAccessioningService(this.species, this.speciesList, this.accessionCategory, this.accessionID)
                        .filter(function(variantObj) {
                            return !_.isEmpty(variantObj);
                        });

        // Any additional processing is meaningless for deprecated variants
        if (this.variantIsDeprecated) {return}

        this.variant.forEach(function(variantObjFromAccService) {
            if (_this.accessionCategory === "clustered-variants") {
                _this.getAssociatedSSIDsFromAccessioningService(_this.accessionCategory, variantObjFromAccService.id).forEach(function(ssIDInfo) {
                        if (variantObjFromAccService.assemblyAccession == ssIDInfo.data.referenceSequenceAccession) {
                            _this.addAssociatedSSID("ss" + ssIDInfo.accession + "_" + ssIDInfo.data.contig,
                            {"ID": "ss" + ssIDInfo.accession,
                            "Study": _this.getProjectAccessionAnchor(ssIDInfo.data.projectAccession),
                            "Contig": ssIDInfo.data.contig, "Start": ssIDInfo.data.start,
                            "End": _this.getVariantEndCoordinate(ssIDInfo.data.start,
                                                                ssIDInfo.data.referenceAllele, ssIDInfo.data.alternateAllele),
                            "Reference": ssIDInfo.data.referenceAllele,
                            "Alternate": [ssIDInfo.data.alternateAllele],
                            "Created Date": _this.getFormattedDate(ssIDInfo.data.createdDate)});
                        }
                });
            }
            // Add attributes from EVA service for the same variant
            if (_.contains(_this.EVASpeciesList, _this.species)) {
                // A position based query would be more accurate but at this time contigs in
                // the accessioning service is not equivalent to those in the EVA service
                var variantInfoFromEVAService = _this.getVariantInfoFromEVAService(variantObjFromAccService.id, _this.queryParams);
                // Prefer nice chromosome numbers, while it lasts, over ugly contig names from the accessioning service
                if (!_.isEmpty(variantInfoFromEVAService)) {
                    variantObjFromAccService.chromosome = variantInfoFromEVAService[0].chromosome;
                    if(!_.isEmpty(_this.associatedSSIDs)) {
                        _.values(_this.associatedSSIDs).forEach(function(ssIDInfo){
                            ssIDInfo.Contig = variantInfoFromEVAService[0].chromosome;
                        });
                    }
                }
                // Match current variant from the Accessioning service against the response from EVA service
                var matchingVariantInfoFromEVAService = variantInfoFromEVAService.filter(function(variantObjFromEVAService) {
                    return _this.areVariantObjectsComparable(variantObjFromEVAService, variantObjFromAccService);
                })[0];
                if (matchingVariantInfoFromEVAService) {
                    for (var key in matchingVariantInfoFromEVAService) {
                        if (!(key in variantObjFromAccService) || typeof(variantObjFromAccService[key]) === 'undefined' ||
                            (variantObjFromAccService[key] === "" && variantObjFromAccService !== "reference" &&
                            variantObjFromAccService !== "alternate")) {
                                    variantObjFromAccService[key] = matchingVariantInfoFromEVAService[key];
                        }
                    }
                }
            }
            _this.addReprToVariantObj(variantObjFromAccService);
        });
    },

    processQueryWithEVAService: function () {
        var _this = this;
        var attributeToSearchBy = this.position ? this.position : this.accessionID;
        this.variant = this.getVariantInfoFromEVAService(attributeToSearchBy, this.queryParams)
                            .filter(function(variantObj) {
                                return !_.isEmpty(variantObj);
                            });
        // Avoid unnecessary calls to associated SS IDs service for calls by position or SS ID
        if (this.accessionCategory === "clustered-variants") {
            this.variant.forEach(function(variantObjFromEVAService) {
                variantObjFromEVAService.associatedSSIDs.forEach(function(ssID) {
                    _this.addAssociatedSSID(ssID + "_" + variantObjFromEVAService.chromosome,
                        {"ID": ssID, "Study": _this.getProjectAccessionAnchorForSSID(ssID),
                        "Contig": variantObjFromEVAService.chromosome,
                        "Start": variantObjFromEVAService.start, "End": variantObjFromEVAService.end,
                        "Reference": variantObjFromEVAService.reference, "Alternate": variantObjFromEVAService.allAlternates,
                        "Created Date": null});
                });
            });
        }
        // Add attributes from the accessioning service for the variant
        if (this.position) {
            this.variant.forEach(function(variantObjFromEVAService) {
                var matchingVariantFromAccessioningService = _.chain(_.values(_this.associatedSSIDs))
                        .map(function(ssIDInfo) {
                            return _this.getVariantInfoFromAccessioningService(_this.species, _this.speciesList,
                                                                                "submitted-variants", ssIDInfo.ID);
                        }).flatten().filter(function(variantObjFromAccService) {
                            return variantObjFromAccService ?
                                _this.areVariantObjectsComparable(variantObjFromAccService, variantObjFromEVAService)
                                : false;
                        }).value()[0];
                for (var key in matchingVariantFromAccessioningService) {
                    if (!(key in variantObjFromEVAService) || !(_this.isValidResponse(variantObjFromEVAService[key]))) {
                        variantObjFromEVAService[key] = matchingVariantFromAccessioningService[key];
                    }
                }
            });
        }
    },

    render: function () {
        this.targetDiv = (this.target instanceof HTMLElement) ? this.target : document.querySelector('#' + this.target);
        if (!this.targetDiv) {
            console.log('EVA-VariantView: target ' + this.target + ' not found');
            return;
        }

        this.queryParams = {species: this.species};
        if(this.annotationVersion){
            var _annotVersion = this.annotationVersion.split("_");
            _.extend(this.queryParams, {'annot-vep-version':_annotVersion[0]},{'annot-vep-cache-version':_annotVersion[1]});
        }
        this.speciesList = getSpeciesList();
        this.EVASpeciesList = getEVASpeciesList().map(function(speciesAttr) {
            return speciesAttr.taxonomyCode + "_" + speciesAttr.assemblyCode;
        });
        this.studiesList = (_.contains(this.EVASpeciesList, this.species) ? this.getStudiesList(this.species) : []);
        this.currAssembly = this.getCurrentAssembly(this.species, this.speciesList);
        this.assemblyLink = this.getAssemblyLink(this.currAssembly);
        this.associatedSSIDs = {};

        if (this.accessionID) {
            this.accessionCategory = this.accessionID.startsWith("rs") ? "clustered-variants": "submitted-variants";
            this.processQueryWithAccessioningService();
        } else {
            this.accessionCategory = "submitted-variants";
        }
        // Proceed to EVA warehouse query if query is position-based or the above processing fails
        if ((this.position || _.isEmpty(this.variant)) && _.contains(this.EVASpeciesList, this.species)) {
            this.processQueryWithEVAService();
        }

        // Check if the variant has been merged
        this.variantIsMerged = false;
        this.variantMergedFrom = null;
        var requestedAccessionID = this.accessionID;
        if (this.variant[0] !== undefined) {
            // Resolved variant is undefined in case an error occurs, e. g. if an incorrect accession has been requested
            var responseAccessionID = this.variant[0].id;
            if (requestedAccessionID !== responseAccessionID) {
                this.variantIsMerged = true;
                this.variantMergedFrom = requestedAccessionID;
            }
        }

        this.draw();

        //sending tracking data to Google Analytics
        ga('send', 'event', { eventCategory: 'Views', eventAction: 'Variant', eventLabel:'species='+this.species+'variant='+this.position});
    },

    createVariantFilesPanel: function (targetDiv, variantData, variantIndex) {
        var _this = this;
        var variantFilesPanel = new EvaVariantFilesPanel({
            panelTableID: "files-panel-table-" + variantIndex,
            panelID: variantData.repr ? variantData.repr.replace("/", "_"):'',
            variantAlleles: variantData.repr,
            invokedFromVariantView: true,
            customMargin: '15 0 10 10',
            target: targetDiv,
            height: 'auto',
            handlers: {
                "load:finish": function (e) {
//                    _this.grid.setLoading(false);
                }
            },
            statsTpl: new Ext.XTemplate(
                '<table class="ocb-stats-table" style="width:300px;">' +
                    '<tr>' +
                    '<td class="header">Minor Allele Frequency:</td>' +
                    '<td><tpl if="maf == -1 || maf == 0">NA <tpl else>{maf:number( "0.000" )} </tpl></td>' +
                    '</tr>',
                '<tr>' +
                    '<td class="header">MAF Allele:</td>' +
                    '<td><tpl if="mafAllele">{mafAllele} <tpl else>NA</tpl></td>' +
                    '</tr>',
                '<tr>' +
                    '<tr>' +
                    '<td class="header">Mendelian Errors:</td>' +
                    '<td><tpl if="mendelianErrors == -1">NA <tpl else>{mendelianErrors}</tpl></td>' +
                    '</tr>',
                '<tr>' +
                    '<td class="header">Missing Alleles:</td>' +
                    '<td><tpl if="missingAlleles == -1">NA <tpl else>{missingAlleles}</tpl></td>' +
                    '</tr>',
                '<tr>' +
                    '<td class="header">Missing Genotypes:</td>' +
                    '<td><tpl if="missingGenotypes == -1">NA <tpl else>{missingGenotypes}</tpl></td>' +
                    '</tr>',
                '</table>'
            )
        });

        variantFilesPanel.load(variantData.sourceEntries, {species: _this.species},  _this.studiesList);
        variantFilesPanel.draw();

        return variantFilesPanel;
    },

    draw: function (data, content) {
        var _this = this;
        var variant = this.variant;

        if(_.isEmpty(variant)){
            var noDataEl = document.querySelector("#summary-grid");
            var noDataElDiv = document.createElement("div");
            noDataElDiv.innerHTML = '<span>No Data Available</span>';
            noDataEl.appendChild(noDataElDiv);
            return;
        }

        var variantViewDiv = document.querySelector("#variantView");
        $(variantViewDiv).addClass('show-div');
        var summaryEl = document.querySelector("#summary-grid");

        // Adding message for a deprecated variant (if necessary)
        if (this.variantIsDeprecated) {
            var deprecatedMessageDiv = document.createElement("div");
            deprecatedMessageDiv.setAttribute("class", "callout alert");
            deprecatedMessageDiv.innerHTML = _.escape("Variant " + variant[0].id + " has been deprecated. " +
                "Summary information about the variant is displayed below for historical purposes. " +
                "This variant ID should not be used.");
            summaryEl.appendChild(deprecatedMessageDiv);
        }

        // Adding message for merged variant (if necessary)
        if (this.variantIsMerged) {
            var mergedMessageDiv = document.createElement("div");
            mergedMessageDiv.setAttribute("class", "callout warning");
            mergedMessageDiv.innerHTML = _.escape("Variant " + this.variantMergedFrom + " has been merged into " +
                variant[0].id + ". Information for the target variant is displayed below.");
            summaryEl.appendChild(mergedMessageDiv);
        }

        // Adding summary content
        var summaryContent = _this._renderSummaryData(variant);
        var summaryElDiv = document.createElement("div");
        summaryElDiv.innerHTML = summaryContent;
        summaryEl.appendChild(summaryElDiv);

        if (this.accessionCategory === "submitted-variants" || this.position) {
            var consqTypeContent = _this._renderConsequenceTypeData(_this.variant);
            if(!_.isUndefined(consqTypeContent) && !_.isEmpty(consqTypeContent)) {
                var consqTypeEl = document.querySelector("#consequence-types-grid");
                var consqTypeElDiv = document.createElement("div");
                consqTypeElDiv.innerHTML = consqTypeContent;
                consqTypeEl.appendChild(consqTypeElDiv);
            }

            var studyEl = document.querySelector("#studies-grid");
            var variantIndex = 1;
            this.variant.forEach(function(variant) {
                var studyElDiv = document.createElement("div");
                studyElDiv.setAttribute('id', "files_" + variant.reference + "_" + variant.alternate);
                studyElDiv.setAttribute('class', 'eva variant-widget-panel ocb-variant-stats-panel');
                studyEl.appendChild(studyElDiv);
                _this.createVariantFilesPanel(studyElDiv, variant, variantIndex);
                variantIndex += 1;
            });

            var genotypesEl = document.querySelector("#genotypes-grid");
            this.variant.forEach(function(variant) {
                var genotypesElDiv = document.createElement('div');
                genotypesElDiv.setAttribute('id', "genotypes_" + variant.reference + "_" + variant.alternate);
                genotypesElDiv.setAttribute('class', 'ocb-variant-genotype-grid');
                genotypesEl.appendChild(genotypesElDiv);
                var variantData = {repr: variant.repr, sourceEntries: variant.sourceEntries, species: _this.species};
                _this._createVariantGenotypeGridPanel(genotypesElDiv, variantData);
            });

            var popStatsEl = document.querySelector("#population-stats-grid-view");
            this.variant.forEach(function(variant) {
                var popStatsElDiv = document.createElement("div");
                popStatsElDiv.setAttribute('id', "popstats_" + variant.reference + "_" + variant.alternate);
                popStatsElDiv.setAttribute('class', 'eva variant-widget-panel ocb-variant-stats-panel');
                popStatsEl.appendChild(popStatsElDiv);
                var variantData = {repr: variant.repr, sourceEntries: variant.sourceEntries, species: _this.species};
                _this._createPopulationStatsPanel(popStatsElDiv, variantData);
            });
        } else {
            document.getElementById("navigation-strip").remove();
        }
    },

    _renderSummaryData: function (data) {
        var _this = this;
        var speciesName, organism;
        if (!_.isEmpty(this.speciesList)) {
            speciesName = _.findWhere(this.speciesList, {taxonomyCode: this.species.split("_")[0]}).taxonomyEvaName;
            organism = speciesName.substr(0, 1).toUpperCase() + speciesName.substr(1);
        } else {
            speciesName = this.species;
        }

        var getSummaryTableHeaderRow = function(summaryData) {
            var header = '';
            _.each(_.keys(summaryData), function(key) {
                if (key === summaryDisplayFields.allelesMatch) {
                    header += '<th><span title="' + allelesMatchToolTip + '">' + key + '</span></th>';
                } else {
                    header += '<th>' + key + '</th>';
                }
            });
            return '<thead><tr>' + header + '</tr></thead>';
        };
        var getSummaryTableContentRow = function(summaryData) {
            var rowContent = '';
            _.each(_.keys(summaryData), function(key) {
                var content = summaryData[key] ? summaryData[key]: '';
                rowContent += '<td>' + content + '</td>';
            });
            return '<tr>' + rowContent + '</tr>';
        };

        var summaryDisplayFields = {organism : "Organism", assembly: "Assembly", submitterHandle: "Study", chromosome: "Contig", start: "Start",
                                    end: "End", reference: "Reference", alternate: "Alternate", id: "ID",
                                    type: "Type", evidence: "Allele frequencies / genotypes available?", assemblyMatch: "Alleles match reference assembly?",
                                    allelesMatch: 'Passed allele checks? <i class="icon icon-generic" data-icon="i">',
                                    validated: '<a id="constant-hyperlink-color" href="https://www.ncbi.nlm.nih.gov/projects/SNP/snp_legend.cgi?legend=validation" target="_blank">Validated?</a>', createdDate: "Created Date"};
        var allelesMatchToolTip = "1) Reference allele appears in the list of alleles that were submitted and 2) Locus orientation was determined definitively";
        var summaryData = data.map(function(x) {
            var summaryDataObj = {};
            summaryDataObj[summaryDisplayFields.organism] = organism;
            summaryDataObj[summaryDisplayFields.assembly] = _this.assemblyLink;
            summaryDataObj[summaryDisplayFields.submitterHandle] = x.submitterHandle;
            summaryDataObj[summaryDisplayFields.chromosome] = x.chromosome;
            summaryDataObj[summaryDisplayFields.start] = x.start;
            summaryDataObj[summaryDisplayFields.end] = x.end;
            summaryDataObj[summaryDisplayFields.reference] = _.escape(x.referenceRepr);
            summaryDataObj[summaryDisplayFields.alternate] = _.escape(x.alternateRepr);
            summaryDataObj[summaryDisplayFields.id] = x.id;
            summaryDataObj[summaryDisplayFields.type] = x.variantTypeLink;
            summaryDataObj[summaryDisplayFields.evidence] = x.evidence;
            summaryDataObj[summaryDisplayFields.assemblyMatch] = x.assemblyMatch;
            summaryDataObj[summaryDisplayFields.allelesMatch] = x.allelesMatch;
            summaryDataObj[summaryDisplayFields.validated] = x.validated;
            summaryDataObj[summaryDisplayFields.createdDate] = x.createdDate;
            return summaryDataObj;
        });
        var variantInfoHeading = "Variant Summary" + (_.isEmpty(summaryData) ? '': ' for ' + summaryData[0].ID);
        var _summaryTable = '<h4 class="variant-view-h4">' + variantInfoHeading + '</h4><div class="row"><div class="col-md-8">';
        var rsReference = '',
            ssInfoHeaderRow = '',
            ssInfoContentRows = '',
            submitterInfoHeading = '';

        if (this.accessionCategory === "clustered-variants") {
            summaryData = summaryData.map(function(x) {return _.omit(x, [summaryDisplayFields.submitterHandle, summaryDisplayFields.end, summaryDisplayFields.reference, summaryDisplayFields.alternate,
                                                          summaryDisplayFields.evidence, summaryDisplayFields.assemblyMatch,
                                                          summaryDisplayFields.allelesMatch, summaryDisplayFields.validated]);}).slice(0,1);
            if (! this.variantIsDeprecated) {  // ssID data are not available for deprecated rsIDs
                submitterInfoHeading = '<h4 class="variant-view-h4">Submitted Variants</b></h4><div class="row"><div class="col-md-8">';
                var associatedSSData = this.associatedSSIDs;
                _.values(associatedSSData).forEach(function (x) {
                    x.ID = '<a href="?variant&accessionID=' + x.ID + '&species=' + _this.species + '">' + x.ID + '</a>';
                });
                ssInfoHeaderRow = getSummaryTableHeaderRow(_.values(associatedSSData)[0]);
                ssInfoContentRows = _.values(associatedSSData).map(getSummaryTableContentRow).join("");
            }
        } else {
            if (data[0].associatedRSID) {
                rsReference = '<small><b>Clustered</b> under <a id="rs-link" href="?variant&accessionID=' +
                                data[0].associatedRSID + '&species=' + this.species + '">' +
                                data[0].associatedRSID + '</a></small>';
            }
        }

        var variantInfoHeaderRow = getSummaryTableHeaderRow(summaryData[0]);
        var variantInfoContentRows = summaryData.map(getSummaryTableContentRow).join("");

        _summaryTable += '<table id="variant-view-summary" class="hover ebi-themed-table" style="font-size: small">' + variantInfoHeaderRow +
                            variantInfoContentRows + '</table>';
        _summaryTable += '</div></div>';
        _summaryTable += ssInfoHeaderRow?
                            submitterInfoHeading + '<table id="submitted-variant-summary" class="table hover" style="font-size: small">' +
                            ssInfoHeaderRow + ssInfoContentRows + '</table>' : '';
        _summaryTable += rsReference;
        _summaryTable += '</div></div>';

        return _summaryTable;

    },
    _renderConsequenceTypeData: function (variantDataArray) {
        var _this = this;
        var variantIndex = 1;
        return variantDataArray.map(function(data) {
            var consequenceTypeHeading = '<h4 class="variant-view-h4"> Consequence Types' + (data.repr ? " for "+data.repr : "") +  '</h4>';
            var noDataAvailableSection = consequenceTypeHeading + '<div>No Consequence Type data available</div>';
            if(_.isUndefined(data.annotation)){
              return noDataAvailableSection;
            }
            var annotation = data.annotation.consequenceTypes;
            if (!annotation) {
                return noDataAvailableSection;
            }
            annotation = annotation.sort(_this._sortBy('ensemblGeneId', _this._sortBy('ensemblTranscriptId')));
            var _consequenceTypeTable = consequenceTypeHeading + '<div class="row"><div><table class="ebi-themed-table" id="consequence-type-summary-' + variantIndex + '" class="table hover" style="font-size: small">';
            _consequenceTypeTable += '<thead><tr><th>Ensembl Gene ID</th><th>Ensembl Transcript ID</th><th>Accession</th><th>Name</th></tr></thead><tbody>';
            _.each(_.keys(annotation), function (key) {
                var annotationDetails = this[key];
                var soTerms = this[key].soTerms;
                _.each(_.keys(soTerms), function (key) {
                    var link = '<a href="' + SO_SERVICE + '/' + this[key].soAccession + '" target="_blank">' + this[key].soAccession + '</a>';
                    var so_term_detail = consequenceTypeDetails[soTerms[0].soName];
                    var color = '';
                    var impact = '';
                    var svg = '';
                    if (!_.isUndefined(so_term_detail)) {
                        color = so_term_detail.color;
                        impact = so_term_detail.impact;
                        svg = '<svg width="20" height="10"><rect x="0" y="3" width="15" height="10" fill="' + color + '"><title>' + impact + '</title></rect></svg>';
                    }

                    var ensemblGeneId = '-';
                    if (annotationDetails.ensemblGeneId) {
                        ensemblGeneId = annotationDetails.ensemblGeneId;
                    }
                    var ensemblTranscriptId = '-';
                    if (annotationDetails.ensemblTranscriptId) {
                        ensemblTranscriptId = annotationDetails.ensemblTranscriptId;
                    }
                    _consequenceTypeTable += '<tr><td class="variant-view-ensemblGeneId">' + ensemblGeneId + '</td><td class="variant-view-ensemblTranscriptId">' + ensemblTranscriptId + '</td><td class="variant-view-link">' + link + '</td><td class="variant-view-soname">' + this[key].soName + '&nbsp;' + svg + '</td></tr>';
                }, soTerms);

            }, annotation);
            _consequenceTypeTable += '</tbody></table></div></div>';
            variantIndex += 1;
            return _consequenceTypeTable;
        }).join("");
    },
    _createPopulationStatsPanel: function (target, variantData) {
        var _this = this;
        this.defaultToolConfig = {
            headerConfig: {
                baseCls: 'eva-header-2'
            }
        };
        var variantPopulationStatsPanel = new EvaVariantPopulationStatsPanel({
            panelID: variantData.repr ? variantData.repr.replace("/", "_"):'',
            variantAlleles: variantData.repr,
            invokedFromVariantView: true,
            height: 'auto',
            target: target,
            customMargin: '0 0 0 10',
            headerConfig: this.defaultToolConfig.headerConfig,
            handlers: {
                "load:finish": function (e) {
                }
            }


        });

        variantPopulationStatsPanel.load(variantData.sourceEntries, {species: variantData.species},  _this.studiesList);
        variantPopulationStatsPanel.draw();

        return variantPopulationStatsPanel;
    },
    _sortBy : function(name, minor){
        return function (o, p) {
            var a, b;
            if (typeof o === 'object' && typeof p === 'object' && o && p) {
                a = o[name];
                b = p[name];
                if (a === b) {
                    return typeof minor === 'function' ? minor(o, p) : o;
                }
                if (typeof a === typeof b) {
                    return a < b ? -1 : 1;
                }
                return typeof a < typeof b ? -1 : 1;
            } else {
                throw {
                    name: 'Error',
                    message: 'Expected an object when sorting by ' + name
                };
            }
        };
    },

    _createVariantGenotypeGridPanel: function (target, variantData) {
        var _this = this;
        var variantGenotypeGridPanel = new EvaVariantGenotypeGridPanel({
            panelID: variantData.repr ? variantData.repr.replace("/", "_"):'',
            variantAlleles: variantData.repr,
            invokedFromVariantView: true,
            target: target,
            gridConfig: {
                flex: 1,
                layout: {
                    align: 'stretch'
                }
            },
            height: 'auto'
        });

        variantGenotypeGridPanel.load(variantData.sourceEntries, {species: variantData.species}, _this.studiesList);
        variantGenotypeGridPanel.draw();

        return variantGenotypeGridPanel;
    }
};
