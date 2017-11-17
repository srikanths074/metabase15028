import { dateParameterValueToMBQL } from "metabase/meta/Parameter";

describe("metabase/meta/Parameter", () => {
    describe("dateParameterValueToMBQL", () => {
        it ("should parse past30days", () => {
            expect(dateParameterValueToMBQL("past30days", null)).toEqual(["time-interval", null, -30, "day"])
        })
        it ("should parse next2years", () => {
            expect(dateParameterValueToMBQL("next2years", null)).toEqual(["time-interval", null, 2, "year"])
        })
        it ("should parse thisday", () => {
            expect(dateParameterValueToMBQL("thisday", null)).toEqual(["time-interval", null, "current", "day"])
        })
        it ("should parse ~2017-05-01", () => {
            expect(dateParameterValueToMBQL("~2017-05-01", null)).toEqual(["<", null, "2017-05-01"])
        })
        it ("should parse 2017-05-01~", () => {
            expect(dateParameterValueToMBQL("2017-05-01~", null)).toEqual([">", null, "2017-05-01"])
        })
        it ("should parse 2017-05", () => {
            expect(dateParameterValueToMBQL("2017-05", null)).toEqual(["=", ["datetime-field", null, "month"], "2017-05-01"])
        })
        it ("should parse Q1-2017", () => {
            expect(dateParameterValueToMBQL("Q1-2017", null)).toEqual(["=", ["datetime-field", null, "quarter"], "2017-01-01"])
        })
        it ("should parse 2017-05-01", () => {
            expect(dateParameterValueToMBQL("2017-05-01", null)).toEqual(["=", null, "2017-05-01"])
        })
        it ("should parse 2017-05-01~2017-05-02", () => {
            expect(dateParameterValueToMBQL("2017-05-01~2017-05-02", null)).toEqual(["BETWEEN", null, "2017-05-01", "2017-05-02"])
        })
    })
})
