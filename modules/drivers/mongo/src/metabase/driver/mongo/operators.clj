(ns metabase.driver.mongo.operators
  "This namespace provides definitions of mongo operators.

   Namespace is a copy of monger's operator namespace.

   TODO: We should consider removing this namespace completely. Having it just adds need for maintaining list of
         operators monger provides. We could use keywords instead. Conversion code currently handles
         transformation of those into strings during transformations to document. More importantly -- we are already
         using keywords in lot of places in [[metabase.driver.mongo.query-processor]]. Try seraching it for `:\\$``
         regex.
   TODO: Linter errors!!!")

(defmacro ^{:private true} defoperator
  [operator]
  `(def ^{:const true} ~(symbol (str operator)) ~(str operator)))

(defoperator $gt)
(defoperator $gte)
(defoperator $lt)
(defoperator $lte)
(defoperator $all)
(defoperator $in)
(defoperator $nin)
(defoperator $eq)
(defoperator $ne)
(defoperator $elemMatch)
(defoperator $regex)
(defoperator $options)
(defoperator $comment)
(defoperator $explain)
(defoperator $hint)
(defoperator $maxTimeMS)
(defoperator $orderBy)
(defoperator $query)
(defoperator $returnKey)
(defoperator $showDiskLoc)
(defoperator $natural)
(defoperator $expr)
(defoperator $jsonSchema)
(defoperator $where)
(defoperator $and)
(defoperator $or)
(defoperator $nor)
(defoperator $inc)
(defoperator $mul)
(defoperator $set)
(defoperator $unset)
(defoperator $setOnInsert)
(defoperator $rename)
(defoperator $push)
(defoperator $position)
(defoperator $each)
(defoperator $addToSet)
(defoperator $pop)
(defoperator $pull)
(defoperator $pullAll)
(defoperator $bit)
(defoperator $bitsAllClear)
(defoperator $bitsAllSet)
(defoperator $bitsAnyClear)
(defoperator $bitsAnySet)
(defoperator $exists)
(defoperator $mod)
(defoperator $size)
(defoperator $type)
(defoperator $not)
(defoperator $addFields)
(defoperator $bucket)
(defoperator $bucketAuto)
(defoperator $collStats)
(defoperator $facet)
(defoperator $geoNear)
(defoperator $graphLookup)
(defoperator $indexStats)
(defoperator $listSessions)
(defoperator $lookup)
(defoperator $match)
(defoperator $merge)
(defoperator $out)
(defoperator $planCacheStats)
(defoperator $project)
(defoperator $redact)
(defoperator $replaceRoot)
(defoperator $replaceWith)
(defoperator $sample)
(defoperator $limit)
(defoperator $skip)
(defoperator $unwind)
(defoperator $group)
(defoperator $sort)
(defoperator $sortByCount)
(defoperator $currentOp)
(defoperator $listLocalSessions)
(defoperator $cmp)
(defoperator $min)
(defoperator $max)
(defoperator $avg)
(defoperator $stdDevPop)
(defoperator $stdDevSamp)
(defoperator $sum)
(defoperator $let)
(defoperator $first)
(defoperator $last)
(defoperator $abs)
(defoperator $add)
(defoperator $ceil)
(defoperator $divide)
(defoperator $exp)
(defoperator $floor)
(defoperator $ln)
(defoperator $log)
(defoperator $log10)
(defoperator $multiply)
(defoperator $pow)
(defoperator $round)
(defoperator $sqrt)
(defoperator $subtract)
(defoperator $trunc)
(defoperator $literal)
(defoperator $arrayElemAt)
(defoperator $arrayToObject)
(defoperator $concatArrays)
(defoperator $filter)
(defoperator $indexOfArray)
(defoperator $isArray)
(defoperator $map)
(defoperator $objectToArray)
(defoperator $range)
(defoperator $reduce)
(defoperator $reverseArray)
(defoperator $zip)
(defoperator $mergeObjects)
(defoperator $allElementsTrue)
(defoperator $anyElementsTrue)
(defoperator $setDifference)
(defoperator $setEquals)
(defoperator $setIntersection)
(defoperator $setIsSubset)
(defoperator $setUnion)
(defoperator $strcasecmp)
(defoperator $substr)
(defoperator $substrBytes)
(defoperator $substrCP)
(defoperator $toLower)
(defoperator $toString)
(defoperator $toUpper)
(defoperator $concat)
(defoperator $indexOfBytes)
(defoperator $indexOfCP)
(defoperator $ltrim)
(defoperator $regexFind)
(defoperator $regexFindAll)
(defoperator $regexMatch)
(defoperator $rtrim)
(defoperator $split)
(defoperator $strLenBytes)
(defoperator $subLenCP)
(defoperator $trim)
(defoperator $sin)
(defoperator $cos)
(defoperator $tan)
(defoperator $asin)
(defoperator $acos)
(defoperator $atan)
(defoperator $atan2)
(defoperator $asinh)
(defoperator $acosh)
(defoperator $atanh)
(defoperator $radiansToDegrees)
(defoperator $degreesToRadians)
(defoperator $convert)
(defoperator $toBool)
(defoperator $toDecimal)
(defoperator $toDouble)
(defoperator $toInt)
(defoperator $toLong)
(defoperator $toObjectId)
(defoperator $dayOfMonth)
(defoperator $dayOfWeek)
(defoperator $dayOfYear)
(defoperator $hour)
(defoperator $minute)
(defoperator $month)
(defoperator $second)
(defoperator $millisecond)
(defoperator $week)
(defoperator $year)
(defoperator $isoDate)
(defoperator $dateFromParts)
(defoperator $dateFromString)
(defoperator $dateToParts)
(defoperator $dateToString)
(defoperator $isoDayOfWeek)
(defoperator $isoWeek)
(defoperator $isoWeekYear)
(defoperator $toDate)
(defoperator $ifNull)
(defoperator $cond)
(defoperator $switch)
(defoperator $geoWithin)
(defoperator $geoIntersects)
(defoperator $near)
(defoperator $nearSphere)
(defoperator $geometry)
(defoperator $maxDistance)
(defoperator $minDistance)
(defoperator $center)
(defoperator $centerSphere)
(defoperator $box)
(defoperator $polygon)
(defoperator $slice)
(defoperator $text)
(defoperator $meta)
(defoperator $search)
(defoperator $language)
(defoperator $natural)
(defoperator $currentDate)
(defoperator $isolated)
(defoperator $count)