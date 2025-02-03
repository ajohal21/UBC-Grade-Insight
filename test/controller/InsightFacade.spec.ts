import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
//
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	let sections: string;
	//file that is not base64 zipped

	//zip that does not have courses folder as root
	let notCourses: string;
	//zip with courses root but nothing in it
	let noContent: string;
	//Zip with courses but each course is empty
	let badJSON: string;

	let course: string;

	before(async function () {
		sections = await getContentFromArchives("pair.zip");
		notCourses = await getContentFromArchives("NoCoursesRoot.zip");
		noContent = await getContentFromArchives("NoContent.zip");
		badJSON = await getContentFromArchives("badJSON.zip");
		//notAZip = await getContentFromArchives("notAZip.zip");
		course = await getContentFromArchives("course.zip");
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			facade = new InsightFacade();
		});

		afterEach(async function () {
			await clearDisk();
		});

		it("should reject with  an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			let err: any;

			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with an dataset ID with an underscore", async function () {
			let err: any;
			try {
				await facade.addDataset("6983_", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because of underscore");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add a dataset", async function () {
			const result = await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			return expect(result).to.have.members(["aman"]);
		});

		it("should reject with a dataset ID that already exists aman", async function () {
			let err: any;
			try {
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because ID already exists!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("Should reject a dataset ID that is just whitespace", async function () {
			let err: any;
			try {
				await facade.addDataset("   ", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because of whitespace");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add multiple valid datasets", async function () {
			const result = await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			expect(result).to.have.members(["aman"]);
			const result2 = await facade.addDataset("aman2", sections, InsightDatasetKind.Sections);

			expect(result2).to.have.members(["aman", "aman2"]);
		});

		it("should successfully add with ID that is any characters except underscore", async function () {
			const result = await facade.addDataset("aman2133!?", sections, InsightDatasetKind.Sections);
			expect(result).to.have.members(["aman2133!?"]);
		});

		it("should reject with a zip file that does not have courses as the root", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", notCourses, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has zero courses in the course root folder", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", noContent, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has coursese but no JSON data in them", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", badJSON, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has is not actually a zip file", async function () {
			let err: any;
			const notAZip = "notAZip";

			try {
				await facade.addDataset("aman", notAZip, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			facade = new InsightFacade();
		});

		afterEach(async function () {
			await clearDisk();
		});

		it("should throw insight error with invalid dataset id of empty string", async function () {
			let err: any;

			try {
				await facade.removeDataset("");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw insight error with invalid dataset id of _", async function () {
			let err: any;

			try {
				await facade.removeDataset("aman_");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw insight error with invalid dataset id of white space", async function () {
			let err: any;

			try {
				await facade.removeDataset("   ");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw notFound error with an ID that is not present", async function () {
			let err: any;

			try {
				await facade.removeDataset("amanj21");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(NotFoundError);
		});

		it("should successfully remove a dataset aman", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			const result = await facade.removeDataset("aman");
			expect(result).to.equal("aman");
		});

		it("should successfully add 2 datasets and remove 2 a datasets", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			await facade.addDataset("aman2", sections, InsightDatasetKind.Sections);

			const remove = await facade.removeDataset("aman");
			expect(remove).to.equal("aman");
			const remove2 = await facade.removeDataset("aman2");
			expect(remove2).to.equal("aman2");
		});

		it("should successfully remove a dataset aman and then add a dataset to check members", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			await facade.removeDataset("aman");

			const add2 = await facade.addDataset("secondAdd", sections, InsightDatasetKind.Sections);
			expect(add2).to.have.members(["secondAdd"]);
		});
	});

	describe("ListDataset", function () {
		beforeEach(async function () {
			facade = new InsightFacade();
		});

		afterEach(async function () {
			await clearDisk();
		});

		it("should list dataset as an array", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.deep.equal([{ id: "aman", kind: InsightDatasetKind.Sections, numRows: 64612 }]);
		});
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<any> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[]; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					return expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				if (expected === "InsightError") {
					return expect(err).to.be.instanceOf(InsightError);
				} else {
					return expect(err).to.be.instanceOf(ResultTooLargeError);
				}
			}
			if (errorExpected) {
				return expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			return expect(result).to.deep.equal(expected);
		}

		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		//valid
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/sections_dept osc asterix at beginning and end.json] sections_dept *osc*", checkQuery);
		it("[valid/valid sections_dept asterix at end.json] sections_dept cp*", checkQuery);
		it("[valid/valid sections_dept asterix in front.json] sections_dept *sc", checkQuery);
		it("[valid/valid sections_deptCpsc no asterix.json] sections_dept cpsc", checkQuery);
		it("[valid/validAverageGt90ANDIsCpsc.json] valid average gt 90 AND is cpsc", checkQuery);
		it("[valid/validAllColumns.json] valid all columns", checkQuery);
		it("[valid/validAllColumnsSections_fail.json] valid all columns sections_fail", checkQuery);
		it("[valid/validBut0Results.json] valid but 0 results", checkQuery);
		it("[valid/validComplexWithORAND.json] valid complex with OR AND", checkQuery);
		it("[valid/validEQ68.9NoOrder.json] valid EQ 68.9 no order", checkQuery);
		it("[valid/validLT70NoOrder.json] valid LT 70 no order", checkQuery);
		it("[valid/validOrderByInstructor.json] valid order by instructor", checkQuery);
		it("[valid/validOrderKeyIsRedundantWithDept.json] valid order key is redundant with dept", checkQuery);
		it(
			"[valid/validCoursesThatHaveAverageNOTGreaterThan76AndNOTLessThan75.6.json] valid courses that have average NOT greater than 76 and NOT less than 75.6",
			checkQuery
		);
		it("[valid/validORLookingForCpscOrPharm.json] valid OR looking for cpsc or pharm", checkQuery);
		it(
			"[valid/validUsingDoubleAsterixAndInstructorByName.json] valid using double asterix and instructor by name",
			checkQuery
		);
		it("[valid/validUsingGTAndOR.json] valid using GT and OR", checkQuery);
		it("[valid/validUsingNOTGT.json] valid using NOT GT", checkQuery);
		it("[valid/validDoubleNotNegatingThemselves.json] valid double not negating themselves", checkQuery);
		it("[valid/validSortingWithStringTypeColumn.json] valid sorting with string type column", checkQuery);
		it("[valid/validANDORGTLTEQISNOTWILDCARD.json] valid AND OR GT LT EQ IS NOT WILDCARD", checkQuery);

		//Invalid
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/invalid sections_dept cpsc AsterixInMiddle.json] sections_dept cp*sc asterix in middle", checkQuery);
		it("[invalid/invalidLowercaseOptions.json] invalid lowercase options", checkQuery);
		it("[invalid/invalidLowercaseWhere.json] invalid lowercase where", checkQuery);
		it("[invalid/invalidNoColumns.json] invalid no columns", checkQuery);
		it("[invalid/invalidNoOptions.json] invalid no options", checkQuery);
		it("[invalid/invalidTooManyResults.json] invalid too many results", checkQuery);
		it("[invalid/invalidNoDataset.json] invalid no dataset", checkQuery);
		it("[invalid/invalidOrderKeyIsNotInColumns.json] invalid order key is not in columns", checkQuery);
		it("[invalid/invalidUsingEQForAString.json] invalid using EQ for a string", checkQuery);
		it("[invalid/invalidUsingADifferentDataset.json] invalid using a different dataset", checkQuery);
		it("[invalid/invalidUsingISForANumber.json] invalid using IS for a number", checkQuery);
		it("[invalid/invalidKeyInColumnsClause.json] invalid key in columns clause", checkQuery);
		it("[invalid/invalidKeyInWhereClause.json] invalid key in where clause", checkQuery);
	});
});
