const BrowserWindow = require('electron');

var dataAccessUrl = "https://data-access-dev.paratext.org";
//var dataAccessUrl = "http://localhost";

// JWT returned from the registry server and required for access to project data
var token = "";

var postStr; // command that would be used to post to data access server
var tipStr; // Hg version number which the app is currently using for Scriptrue data
var currentProjectId; // id of the selected project
var currentProjectName; // short name of the selected project
var requestType; // whether requesting Scripture or notes
var bookId; // selected book id for the query
var textChapterStr; // (optional) selected chapter for Scripture

var noteRangeStr; // (optional) Scripture range for notes
var noteStatusType; // (optional) whether resolved notes or all notes should be requested
var noteStartDate; // (optional) the date on or after which notes will be included; if not specified, notes for all dates would be included

var origRevisionsXml; // original revision information when book text obtained from S/R server.

// Sets the Paratext username and registration code.
function submitData() {
	document.getElementById("usernameDisplay").innerHTML = document.getElementById("username").value;
	document.getElementById("regCodeDisplay").innerHTML = document.getElementById("regCode").value;
	authenticate();
}

// Attempt JWT authentication sending the registry server a Paratext user's name and registration code.
function authenticate() {
	token = "";
	var userName = document.getElementById("usernameDisplay").innerHTML;
	var registrationCode = document.getElementById("regCodeDisplay").innerHTML;
	if (isEmpty(userName) || isEmpty(registrationCode)) {
		alert("Must specify both username and registration code to authenticate.");
		document.getElementById("authenticateState").innerHTML = "User not authenticated";
		return;
	}
	
	// Post data to get JwtToken
	var request = new XMLHttpRequest();
	request.open("POST", "https://registry-dev.paratext.org/api8/token/", true, userName, registrationCode);
	request.setRequestHeader("Content-type", "application/json");
	request.onreadystatechange = function () {
		if (request.readyState === 4 && request.status === 200) {
			var responseJson = JSON.parse(request.responseText);
			token = responseJson["access_token"];
			updateRequestStatus();
		} else if (request.status >= 400) {
		    showModal("Error authenticating user", request.status + ": " + request.responseText);
		    updateRequestStatus();
		}
	}
	
	var data = JSON.stringify({"grant_type": "client_credentials", "scope": "projects.members data_access"});
	request.send(data);
}

// First-time initialization of view.
function initializeView() {
    initializeDatePicker();
    showDate(false);
    requestType = "";
    updateRequestStatus();
    displayRequest();
}

// Specify how date picker should be formatted.
function initializeDatePicker() {
    var date_input = $('input[name="date"]');
    var container = "body";
    var options = {
        format: 'yyyy-mm-dd',
        container: container,
        todayHighlight: true,
        autoclose: true
    };
    date_input.datepicker(options);
}

// Update display to show controls if user is authenticated.
function updateRequestStatus() {
	if (isAuthenticated()) {
		setupForDataAccessRequest();
		getProjects(getListOfProjects, true);
	}
	else {
	    document.getElementById("authenticateState").innerHTML = "(User not authenticated)";
	    document.getElementById("userProjects").innerHTML = "";
	}
}

// Make an API GET request.
function makeServerRequest() {
	// An empty request string will display the API help documentation
	var requestStr = document.getElementById("srvrRequest").value;

	var request = new XMLHttpRequest();
	var url = dataAccessUrl + requestStr;
	console.log('Request url: ' + url);
	request.open("GET", url, true);
	request.setRequestHeader("Authorization", "Bearer " + token);
	request.onreadystatechange = function() {
	    if (request.readyState == XMLHttpRequest.DONE) {
	        if (request.status >= 400) {
	            document.getElementById("dataDisplay").innerHTML = "";
	            document.getElementById("transformBtn").innerHTML = "";
	            var html = "<p>" + url + "</p>";
	            html = html + "<p>Failed with status of " + request.status + "</p>";
	            if (!isEmpty(request.responseText)) {
	                html = html + "<p>" + request.responseText + "</p>";
	            } else if (request.status == 405 && isEmpty(bookId)) {
	                html = html + "<p>Book must be selected for API call</p>";
	            }
	            showModal("Unable to complete request to server", html);
	        } else {
	            document.getElementById("dataDisplay").innerHTML = "<div id=\"data\" contenteditable=\"true\">" + changeDataForDisplay(request.responseText) + "</div>";
	            disablePostToServer();

	            if (isEmpty(request.responseText)) {
	                showModal("No data found on server", "<p>No data was found on the Data Access server for the request:</p><p>" + url + "</p>");
	            }

	            /* Add button to transform XML */
	            /* TODO: Need to (1) pass parameters to XSLT as is done with C#; (2) write extension methods in JavaScript */
	            if (document.getElementById("data").innerHTML.includes('usx')) {
	                // request is for Scripture text
	                document.getElementById("transformBtn").innerHTML = "<a class=\"btn btn-primary indent\" onclick=\"transform()\">Transform</a>";
	                document.getElementById("checkBookRevOnServer").innerHTML = "<a class=\"btn btn-primary indent\" onclick=\"getRevisions(checkBookRevisions)\"" +
                        " title='Displays how hg revisions have changed for the book " + bookId + " since it was obtained, if at all'>Check Revisions</a>";
	                origRevisionsXml = getRevisions(initializeBookRevisions);
	            } else {
	                // request is for notes
	                document.getElementById("transformBtn").innerHTML = "";
	                document.getElementById("checkBookRevOnServer").innerHTML = "";
	                origRevisionsXml = "";
	            }

	            // Listen for changes on the requested data...
	            var e = document.getElementById('data');
	            e.oninput = enablePostToServer;
	        }
		}
		else if (request.readyState != XMLHttpRequest.LOADING && !isEmpty(request.responseText)) {
			alert("ReadyState: " + request.readyState + "\nData Access Server response: \n" + request.responseText);
		}
	}
	request.send(null);
	document.getElementById("dataChangedButton").innerHTML = "";
	document.getElementById("dataDisplay").innerHTML = "<p class=\"indent2\">GET request in progress...</p>";
}

// Make an API POST request.
function postRequest() {
	var request = new XMLHttpRequest();
	var url = dataAccessUrl + postStr;
	request.open("POST", url, true);
	request.setRequestHeader("Authorization", "Bearer " + token);
	request.onreadystatechange = function() {
	    if (request.readyState == XMLHttpRequest.DONE) {
	        if (request.status >= 400) {
	            showModal("Post to DataAccess server attempt failed", "<p>" + postStr + "</p><p>" +
	                request.responseText + "</p>");
	        } else {
	            showModal("Post to DataAccess server complete", "<p>" + postStr + "</p>" +
	                "<p>New project tip id: " + request.responseText + "</p>");
	        }
			tipStr = request.responseText;
			disablePostToServer(); // data in app same as on server so disable POSTing until data is changed again
	        $('body').css('cursor', 'default');
		}
	}
	request.send(changeDataForSaving(document.getElementById("data").innerHTML));
    $('body').css('cursor', 'progress');
}

function displayRequestChoice() {
	document.getElementById("requestType").innerHTML = 
		"<div class=\"indent\"><div class=\"panel panel-default\"> \
			<div class=\"indent\"><form> \
				<span class=\"strong\">Request type: </span> \
				<label class=\"radio-inline\" onclick=\"setRequestType('text')\"><input type=\"radio\" name=\"optradio1\">Scripture</label> \
				<label class=\"radio-inline\" onclick=\"setRequestType('notes')\"><input type=\"radio\" name=\"optradio1\">Notes</label> \
			</form></div> \
		</div></div>";
}

function setRequestType(type) {
	textChapterStr = noteRangeStr = noteStatusType = noteStartDate = document.getElementById("date").value = "";
	addQueryDetails(type);
	requestType = type;
	displayRequest();
}

function addQueryDetails(queryType) {
	if (queryType == "text") {
		document.getElementById("queryDetails").innerHTML = 
			"<div class=\"indent\"> \
			<div class=\"panel panel-default\"> \
				<div class=\"indentboth\"><form> \
				  <div class=\"form-group\"> \
					<label for=\"chapter\">Chapter:</label> \
					<input type=\"text\" class=\"form-control\" id=\"chapter\" oninput=\"setScrChapter()\" placeholder=\"Enter the chapter or leave empty for all chapters\"> \
				  </div> \
				</form> \
			</div></div></div>";
		showDate(false);
	} else if (queryType == "notes") {
	    document.getElementById("queryDetails").innerHTML =
		    "<div class=\"indent\"><div id=\"noteTypes\" class=\"panel panel-default\"> \
				<div class=\"indent\"> \
				<div class=\"radio\"> \
				  <label><input type=\"radio\" name=\"optradio2\" onclick=\"setNoteTypes('')\">All notes</label> \
				</div> \
				<div class=\"radio\"> \
				  <label><input type=\"radio\" name=\"optradio2\" onclick=\"setNoteTypes('unresolved')\">Unresolved notes only</label> \
				</div></div> \
			</div> \
		    <div id=\"rangeEntry\" class=\"panel panel-default\"> \
				<div class=\"indentboth\"> \
				<form> \
				  <div class=\"form-group\"> \
					<label for=\"verseRange\">Verse range:</label> \
					<input type=\"text\" class=\"form-control\" id=\"verseRange\" oninput=\"setNoteVerseRange()\" placeholder=\"Enter the verse range to select notes\"></input> \
					<span class=\"help-inline\">e.g. for chapters: \"4\" or \"4-7\"; </span> \
					<span class=\"help-inline\">  for verse ranges: \"4.1-3\"  or  \"4.3-5.2\"</span> \
				  </div> \
				</form> \
			</div></div>"; 

	    showDate(true);
	}
	document.getElementById("queryDetails").innerHTML = document.getElementById("queryDetails").innerHTML + "</div>";
	
	displayRequest();
}

// Show or hide control to set date.
// NOTE: The date control had to be present in the original document so it is hidden or shown depending on whether the query is for notes
//   rather than being added and removed from the html.
function showDate(visible) {
    var dateNode = document.getElementById('dateQuery');
    if (visible) {
        dateNode.style.display = 'block';
    } else {
        dateNode.style.display = 'none';
    }
}

function transform() {
	var xml = changeDataForSaving(document.getElementById("data").innerHTML);
	
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", "file:///E:/Paratext/electron/DataAccess/xslt/SimpleUnformatted.xslt", false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(xml, "text/xml");

                var xslFile = rawFile.responseText;
				var xslDoc = parser.parseFromString(xslFile, "text/xml");
				var xslt = new XSLTProcessor();
				xslt.importStylesheet(xslDoc);
				
				// Helpful topic for converting XML to string and displaying in page:
				//   https://stackoverflow.com/questions/9898698/convert-xml-to-string-and-append-to-page
				var htmlDoc = xslt.transformToDocument(xmlDoc);
				var convertedXmlStr = new XMLSerializer().serializeToString(htmlDoc);
				console.log(convertedXmlStr);
				var parentDiv = document.getElementById("data");
				parentDiv.innerHTML = "";
				
				// To add html to view...
				parentDiv.appendChild(htmlDoc.firstChild);
				
				// To display literal HTML...
				//var xmlTextNode = document.createTextNode(convertedXmlStr);
				//parentDiv.appendChild(xmlTextNode);
            }
        }
    }
    rawFile.send(null);
}

// Display the API call request
function displayRequest() {
    if (isEmpty(requestType)) {
        if (document.getElementById("srvrRequest")) {
            document.getElementById("srvrRequest").value = "";
        }
	    document.getElementById("getFromServer").innerHTML = "";
		return;
	}
	
	document.getElementById("srvrRequest").value = "/api8/" + requestType + "/" + currentProjectId;
	
	if (!isEmpty(bookId)) {
		document.getElementById("srvrRequest").value = document.getElementById("srvrRequest").value + "/" + bookId;
	}
	
	if (requestType == "text") {
		if (!isEmpty(textChapterStr)) {
			document.getElementById("srvrRequest").value = document.getElementById("srvrRequest").value + "/" + textChapterStr;
		}
	} else if (requestType == "notes") {
		if (!isEmpty(noteRangeStr)) {
			document.getElementById("srvrRequest").value = document.getElementById("srvrRequest").value + "?range=" + noteRangeStr;
		}
		if (!isEmpty(noteStatusType)) {
			document.getElementById("srvrRequest").value = document.getElementById("srvrRequest").value + getParamDelimiter() + "status=" + noteStatusType;
		}
		if (!isEmpty(noteStartDate)) {
		    document.getElementById("srvrRequest").value = document.getElementById("srvrRequest").value + getParamDelimiter() + "after=" + noteStartDate;
		}
	}

    document.getElementById("getFromServer").innerHTML =
        "<a id=\"submitRequest\" onclick=\"makeServerRequest()\" class=\"btn btn-primary\" title=\"Get from Data Access server using above command\">Get Data</a>";
}

// Gets the appropriate delimiter for a parameter on an API call.
function getParamDelimiter() {
	if (document.getElementById("srvrRequest").value.includes("?")) {
		return ("&"); // request already has other parameters
	} else {
		return ("?");
	}
}

// Get current user's Paratext projects that are on the development registry server.
function getProjects(handleProjects, updateCurrent) {
    var request = new XMLHttpRequest();
    var url = dataAccessUrl + "/api8/projects";
    console.log('Projects url: ' + url);
	request.open("GET", url, true);
	request.setRequestHeader("Authorization", "Bearer " + token);
	request.onreadystatechange = function () {
		if (request.readyState === 4 && request.status === 200) {
			var projectsXml = request.responseText;
			handleProjects(projectsXml, updateCurrent);
		}
	};
	
	request.send(null);
}

// Get Hg revisions for currently-selected book on Send/Receive server.
function getRevisions(handleRevisionInfo) {
    var request = new XMLHttpRequest();
    var url = dataAccessUrl + "/api8/revisions/" + currentProjectId + "/" + bookId;
    console.log('Revision url: ' + url);
	request.open("GET", url, true);
	request.setRequestHeader("Authorization", "Bearer " + token);
	request.onreadystatechange = function () {
	    if (request.readyState === 4 && request.status === 200) {
	        handleRevisionInfo(request.responseText);
	        $('body').css('cursor', 'default');
	    } else if (request.status >= 400) {
	        $('body').css('cursor', 'default');
	    }
	};
	
	request.send(null);
    $('body').css('cursor', 'progress');
}

// Callback method for getRevisions after API call to /api8/revisions is complete to set original book revisions.
function initializeBookRevisions(revisionXml) {
    origRevisionsXml = revisionXml;
}

// Callback method for getRevisions after API call to /api8/revisions is complete to show whether book revisions had been modified.
function checkBookRevisions(currentRevisionsXml) {
    var tipRevisionIds = {
        origTipId: getTipId(origRevisionsXml),
        currentTipId: getTipId(currentRevisionsXml)
    }
    var chapterUpdatedOnServer = [];
    var chapterDeletedOnServer = [];

    var origNodes = getNodesFromXmlStr(origRevisionsXml);
    var currentNodes = getNodesFromXmlStr(currentRevisionsXml);
    for (i = 0; i < origNodes.length; i++) {
        if (origNodes[i].attributes) {
            var chapterNum = origNodes[i].attributes["chapter"].value;
            var origRevisionId = origNodes[i].attributes["revision"].value;
            var currentNode = getAllElementsWithAttribute(currentNodes, "chapter", chapterNum);
            if (currentNode.length > 1) {
                alert('Invalid XML. ' + bookId + ' has more than one chapter ' + chapterNum);
            } else if (currentNode.length == 0) {
                chapterDeletedOnServer.push(chapterNum);
            }
            else {
                var currentRevisionId = currentNode[0].attributes["revision"].value;
                if (currentRevisionId != origRevisionId) {
                    var updatedChapter = {
                        chapter: chapterNum,
                        origRev: origRevisionId,
                        currentRev: currentRevisionId
                    }
                    console.log("Chapter: " + chapterNum + ", Original Rev: " + origRevisionId + ", Current Rev: " + currentRevisionId);
                    chapterUpdatedOnServer.push(updatedChapter);
                }
            }
        }
    }

    showChangedRevisionDlg(tipRevisionIds, chapterUpdatedOnServer, chapterDeletedOnServer);
}

// Display a modal dialog with the specified title and content.
function showModal(title, content) {
    document.getElementById("modalTitle").innerHTML = title;
    document.getElementById("modalBody").innerHTML = content;

    // open link to this modal dialog...
    var linkToStatusModal = document.getElementById('showModal');
    linkToStatusModal.click();
}

// Display how Hg revisions have changed for the entire project and individual chapters in the current book, if any.
// Also, display any chapters that have been deleted on the server in the current book.
function showChangedRevisionDlg(tipRevisionIds, chaptersUpdatedOnServer, chapterDeletedOnServer) {
    var title = "Revision status for " + bookId + " in " + currentProjectName;
    
    // Reporting status of project tip
    var html; 
    if (tipRevisionIds.origTipId != tipRevisionIds.currentTipId) {
        html = "<p title='Original hg tip id: " + tipRevisionIds.origTipId + "\nCurrent hg tip id: " + tipRevisionIds.currentTipId + 
            "'>Project has been modified on the Send/Receive server since obtained.</p>";
    }
    else {
        html = "<p title='hg tip id: " + tipRevisionIds.origTipId + "'>Nothing in project has changed on the Send/Receive server since obtained.</p>";
    }

    // Reporting which chapters (if any) have been modified since getting project from server.
    html = html + "<p><strong>Chapters updated on Send/Receive server...</strong></p>"
    html = html + "<div class=\"indent\"><ul class=\"pagination pagination-sm indent\">";
    if (chaptersUpdatedOnServer.length > 0) {
        for (var i = 0; i < chaptersUpdatedOnServer.length; i++) {
            if (chaptersUpdatedOnServer[i].chapter != "0") {
                html = html + "<li class=\"active\" title='Current id: " + chaptersUpdatedOnServer[i].currentRev +
                    "\nLocal id: " + chaptersUpdatedOnServer[i].origRev + "'><a>" + chaptersUpdatedOnServer[i].chapter + "</a></li>";
            }
        }
    } else {
        html = html + "<li class=\"active\"><a>No chapters updated</a></li>";
    }
    html = html + "</ul></div>";

    // Reporting which chapters (if any) have been deleted since getting project from server.
    html = html + "<p><strong>Chapters deleted on Send/Receive server...</strong></p>"
    html = html + "<div class=\"indent\"><ul class=\"pagination pagination-sm indent\">";
    if (chapterDeletedOnServer.length > 0) {
        for (var i = 0; i < chapterDeletedOnServer.length; i++) {
            html = html + "<li class=\"active\"><a>" + chapterDeletedOnServer[i] + "</a></li>";
        }
    } else {
        html = html + "<li class=\"active\"><a>No chapters deleted</a></li>"
    }
    html = html + "</ul></div>";

    showModal(title, html);
}

// Get the current project's tip id using the XML that is obtained from an API call to /api8/revisions
function getTipId(revisionXmlString) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(revisionXmlString, "text/xml");
    return xmlDoc.getElementsByTagName("RevisionInfo")[0].getAttribute("projectTipId");
}

// Get nodes from XML string.
function getNodesFromXmlStr(xmlString) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, "text/xml");
    return xmlDoc.documentElement.childNodes;
}

// Get all elements with a particular attribute value. Original code in: 
//   https://stackoverflow.com/questions/9496427/get-elements-by-attribute-when-queryselectorall-is-not-available-without-using-l
// Function is modified to take a list of child nodes and desired attribute value. 
// The original way of getting the attribute value did not work with this version of JavaScript so that was modified as well.
function getAllElementsWithAttribute(nodes, attributeName, attributeValue) {
    var matchingElements = [];
    for (var i = 0, n = nodes.length; i < n; i++) {
        if (nodes[i].attributes && nodes[i].getAttribute(attributeName) == attributeValue) {
            // Element exists with attribute. Add to array.
            matchingElements.push(nodes[i]);
        }
    }
    return matchingElements;
}

// Gets list of projects for the currently-authenticated user using the XML returned from the API call /api8/projects
function getListOfProjects(projectsXml, updateCurrent) {
	var htmlStr = 
		"<div class=\"indent\"><div class=\"panel-group\" id=\"accordion\"> \
			<div class=\"panel panel-default\"> \
				<div class=\"panel-heading\"> \
				<h4 class=\"panel-title\"> \
				  <a data-toggle=\"collapse\" data-parent=\"#accordion\" href=\"#collapse1\">Paratext Project <small id=\"projectNameDisplay\">(None selected)</small></a> \
				</h4> \
			  </div> \
			  <div id=\"collapse1\" class=\"panel-collapse collapse in\"> \
				<div id=\"projectList\" class=\"panel-body\">";

	var nodes = getNodesFromXmlStr(projectsXml);
	var nodesArray = Array.prototype.slice.call(nodes, 0);
	nodesArray.sort(function (a, b) {
        // sort projects by their short name
	    var aName = a.childNodes[0].innerHTML;
	    var bName = b.childNodes[0].innerHTML;
	    if (aName > bName) return 1;
	    if (aName < bName) return -1;
	    return 0;
	});

	for (i = 0; i < nodesArray.length; i++) {
	    titleStr = "Project type: " + nodesArray[i].childNodes[2].innerHTML +
			"\nHg tip id: " + nodesArray[i].childNodes[4].innerHTML +
			"\nProject id: " + nodesArray[i].childNodes[1].innerHTML;
		htmlStr = htmlStr + "<div class=\"radio\" title=\"" + titleStr + 
			"\" onclick=\"setProject('" + nodesArray[i].childNodes[0].innerHTML + "','" + nodesArray[i].childNodes[1].innerHTML + "')\"> \
			<label><input type=\"radio\" name=\"optradio3\">" + 
		    nodesArray[i].childNodes[0].innerHTML + "</label></div>";
	}
	
	document.getElementById("userProjects").innerHTML = htmlStr + "</div></div></div></div>";
	
	requestType = "";
}

// Gets the node for the currently-selected project from the XML returned from the API call to /api8/projects.
function getSelectedProjInfo(selectedProjectId, projectsXml) {
	var nodes = getNodesFromXmlStr(projectsXml);
	for (i = 0; i < nodes.length; i++) {
		console.log("nodes[" + i + "]- Project name: " + nodes[i].childNodes[0].innerHTML + ", Tip: " + nodes[i].childNodes[4].innerHTML);
		if (nodes[i].childNodes[1].innerHTML == selectedProjectId) {
			return nodes[i]; // found project matching id for project referenced in GET request
		}
	}
	
	return null;
}

// Sets the selected project and adjusts UI for the selection of a new project.
function setProject(projName, projId) {
	currentProjectName = projName;
	currentProjectId = projId;
	document.getElementById("projectNameDisplay").innerHTML = "Selected project: " + projName;
	document.getElementById("queryDetails").innerHTML = "";
	showDate(false);
	document.getElementById("date").value = "";
	document.getElementById("srvrRequest").value = "";
	
	// Now that project is selected, display books and allow user to select type of server request.
	getProjectBooks();
	displayRequestChoice();
	bookId = ""; // reset book choice when project is reset
}

// Sets the current book.
function setBook(selectedBookId) {
	if (!isEmpty(bookId)) {
		// if another book was selected, make it inactive
		document.getElementById("bk" + bookId).classList.toggle('active');
	}
	bookId = selectedBookId;
	document.getElementById("bk" + selectedBookId).classList.toggle('active');
	displayRequest();
}

// Sets the chapter for a GET/POST API call to /api8/text.
function setScrChapter() {
	textChapterStr = document.getElementById("chapter").value;
	displayRequest();
}

// Sets the range of chapters/verses for which notes should be returned from a GET /api8/notes API call.
function setNoteVerseRange() {
	noteRangeStr = document.getElementById("verseRange").value;
	displayRequest();
}

// Sets the date for which notes should be returned from a GET /api8/notes API call. 
// Notes created on or after this day will be included.
function setNoteStartDate() {
    noteStartDate = document.getElementById("date").value;
    displayRequest();
}

// Sets the resolved status for which notes should be returned from a GET /api8/notes API call.
function setNoteTypes(statusType) {
	noteStatusType = statusType;
	displayRequest();
}

// Gets the books in the currently-selected project using an API call to /api8/books
function getProjectBooks(queryType) {
	bookId = textChapterStr = noteRangeStr = noteStatusType = "";

	// Display books in the currently-selected project.
	var request = new XMLHttpRequest();
	var url = dataAccessUrl + "/api8/books/" + currentProjectId;
	console.log('Books url: ' + url);
	request.open("GET", url, true);
	request.setRequestHeader("Authorization", "Bearer " + token);
	request.onreadystatechange = function () {
		if (request.readyState === 4 && request.status === 200) {
			var htmlStr =
				"<div id=\"bookIdList\" class=\"indent\"> \
					<div class=\"panel panel-default\"> \
						<div class=\"indent\"> \
						<strong>Books in " + currentProjectName + ":</strong><br /> \
						<ul class=\"pagination pagination-sm\">";

			var nodes = getNodesFromXmlStr(request.responseText);
			for (i = 0; i < nodes.length; i++) {
				if (nodes[i].attributes) {
					var bkId = nodes[i].attributes["id"].value;
					htmlStr = htmlStr + "<li id=\"bk" + bkId + "\"><a onclick=\"setBook('" + bkId + "')\">" + bkId + "</a></li>";
				}
			}

			document.getElementById("projectBooks").innerHTML = htmlStr + "</ul></div></div></div>";
		}
	};
	
	request.send(null);
}

// Gets whether the username and registration code has been authenticated by the Paratext registry server.
function isAuthenticated() {
	return !isEmpty(token);
}

// Reset ability in UI to post to server (e.g. the project was just posted and there are no more changes to post).
function disablePostToServer() {
	postStr = "";
	document.getElementById("dataChangedButton").innerHTML = "";
}

// Set up UI so that posts can be made to the server.
function enablePostToServer() {
	if (!isEmpty(postStr))
		return; // post already enabled
	
    // Set POST request using the GET request
    var getCommandStr = document.getElementById("srvrRequest").value;
    if (getCommandStr.includes("/text/")) {
        // GET request is for Scripture so POST request should be the same as GET
        postStr = getCommandStr;
    } else if (getCommandStr.includes("/notes/")) {
        // GET request is for notes so POST request should remove book and any following parameters, if present
        postStr = "";
        getCommandStr.split("/").forEach(buildNotesPost);
        document.getElementById("serverTipId").innerHTML = "";
    } else {
        return;
    }

	document.getElementById("dataChangedButton").innerHTML = "<a href=\"#\" id=\"submitRequest\" onclick=\"postRequest()\" class=\"btn btn-primary\"" +
	    "title='Save data to the Data Access server using the command:\n" + postStr + "'>Save Data</a>";
}

// Build the POST request for notes from the GET request. Only the first three values are desired: /api8/notes/{projectGuid}
function buildNotesPost(item, index) {
	if (index > 3 || isEmpty(item))
		return;
	postStr = postStr + "/" + item;
}

function setupForDataAccessRequest() {
	document.getElementById("authenticateState").innerHTML = "(Authenticated)";
	document.getElementById("requestRegion").innerHTML = 
			"<form> \
			  <div class=\"form-group\"> \
				<label for=\"srvrRequest\">Server request:</label> \
				<input type=\"text\" class=\"form-control\" id=\"srvrRequest\" placeholder=\"Enter request for S/R data access server\"> \
			  </div> \
			</form>";
	disablePostToServer(); // data just loaded from server, so no changes have been made
}

// Gets whether the specified string is empty.
function isEmpty(str) {
    return (!str || str.length === 0);
}

// Escape less than and greater than characters so that data returned from the server may be displayed.
function changeDataForDisplay(dataStr) {
	return dataStr.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Unescape less than and greater than characters so that data may be saved back to the server (or processed).
function changeDataForSaving(dataStr) {
	return dataStr.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// From https://stackoverflow.com/questions/14446447/javascript-read-local-text-file
function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                alert(allText);
				return allText;
            }
        }
    }
    rawFile.send(null);
}

// Old method of getting status. More information is provided now. This is only included here for reference.
//function getStatusOfCurrentProject(projectsXml, updateCurrentTipId) {
//    var commandArray = document.getElementById("srvrRequest").value.split("/");
//    if (commandArray.length < 4)
//        return; // command is not long enough to specify the project

//    var projectId = commandArray[3];

//    var selectedProjInfo = getSelectedProjInfo(projectId, projectsXml);
//    if (selectedProjInfo) {
//        if (updateCurrentTipId) {
//            // Updating current tip Id (with GET or POST of Scripture)
//            document.getElementById("currentTipId").innerHTML =
//                "<p class=\"small\">Tip id for project " + selectedProjInfo.childNodes[0].innerHTML + ": " + selectedProjInfo.childNodes[4].innerHTML + "</p>";
//            tipStr = selectedProjInfo.childNodes[4].innerHTML;
//        } else {
//            // Determining if current server Hg tip Id is the same as what is currently in use.
//            if (selectedProjInfo.childNodes[4].innerHTML == tipStr) {
//                document.getElementById("serverTipId").innerHTML = "<p class=\"small indent\">Updating most current version on server</p>";
//            } else {
//                document.getElementById("serverTipId").innerHTML = "<p class=\"small indent\">UPDATED ON SERVER - NOT EDITING CURRENT</p>";
//            }
//        }
//    } else {
//        document.getElementById("projectStatus").innerHTML = "<p class=\"small\">Status for project not found.</p>";
//    }
//}

//// Update displayed status of project
//function displayProjectStatus() {
//    var requestArgs = document.getElementById("srvrRequest").value.split("/");
//    if (requestArgs.length > 2 && requestArgs[2] == "text") {
//        // Scripture request
//        document.getElementById("projectStatusBtn").innerHTML =
//            "<a id=\"submitRequest\" onclick=\"getProjects(getStatusOfCurrentProject, false)\"  class=\"btn btn-primary\">Get project status</a>";
//        document.getElementById("serverTipId").innerHTML = "<p class=\"small indent\">Updating most current version on server</p>";
//        getProjects(getStatusOfCurrentProject, true);
//    } else {
//        document.getElementById("serverTipId").innerHTML = "";
//        if (requestArgs.length > 2 && requestArgs[2] == "notes") {
//            // Notes request
//            document.getElementById("projectStatusBtn").innerHTML = "<p class=\"small\">Request is for notes so version/tip id is not relevant.</p>";
//        } else {
//            document.getElementById("projectStatusBtn").innerHTML = ""; // request is neither for Scripture nor for notes
//        }
//    }
//}

// Note: this method not currently used. Replaced with modal dialog in index.html.
let regWindow
function openRegWindow() {
	alert("Opening registration window...");
	regWindow = new BrowserWindow({parent: top, modal: true, show: false});
    mainWindow.loadURL(url.format({
	  pathname: path.join(__dirname, 'RegistrationForm.html'),
	  protocol: 'file:',
	  slashes: true
    }));
}
