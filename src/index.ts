import { Octokit } from "@octokit/rest";

import {config} from "dotenv";

import * as fs from "fs/promises";

config();

const app = new Octokit({
  auth: process.env.TOKEN,
});

/**
 * Reduces array of Language objects into one object
 * @param arr Array of {[k : string] : number}'s
 * @returns Single Object, with identical keys' values summed 
 */
const reduceLangObj = arr => arr.reduce((obj, l) => {
  let tmp = {...obj};

  Object.entries(l)
    .forEach(([key, value]) => tmp = {...tmp, [key] : (tmp[key] ?? 0) + value });

  return tmp;
}, {});

/**
 * Gets the Languages used in this 50 of this user's repos
 * @param username GitHub username
 * @returns Object of Language => Total Bytes in all the user's repos 
 */
async function getLangs(username : string) {
  let {data: repos} = await app.repos.listForUser({username, per_page: 50, type: "owner"});

  try {
    return await Promise.all(
      repos
        .map(({languages_url, name}) => ({languages_url, name}))
        .map(async ({languages_url: l, name}) => (
          (await app.request(l).catch(e => ({data: []}))).data
        ))
    ).then(reduceLangObj);
  } catch(e) {
    console.warn(e)
    return {};
  }
}

async function main() {
  // Get Languages of the users passed as arguments.
  const LANGS = await Promise.all(
    process.argv.slice(2)
      .map(async name => ({
        name, 
        langs : await getLangs(name)
      })
  ));

  await fs.mkdir(
    "./output",
    {recursive: true}
  );

  // Write raw language bytes per user. 

  await fs.writeFile(
    "./output/by_name.json",
    JSON.stringify(LANGS, null, 3)
  );

  // Add all the bytes up for another metric
  let accumulated = reduceLangObj(LANGS.map(({langs}) => langs))

  await fs.writeFile(
    "./output/total.json",
    JSON.stringify(accumulated, null, 3)
  );

  // Calculate the % breakdown of each language per user 
  const PERCENT_PER_USER = LANGS.map(({langs, name}) =>{
    const TOTAL = Object.values(langs).reduce((a : number, b : number) => a + b, 0) as number
    
    return {
      name,
      TOTAL,
      langs : Object.entries(langs)
      .map(([key, value] : [string, number]) => ({[key] : Math.floor(value / TOTAL * 10_000) / 100}))
      .reduce((obj, b) => ({...obj, ...b}), {})
    };
  }); 

  await fs.writeFile(
    "./output/percent_by_name.json",
    JSON.stringify(PERCENT_PER_USER, null, 3)
  );


  // Calculate total scores for the entire group,
  // and weight it by the log base 5 of each user's total bytes
  // then sum
  const WEIGHTED_TOTAL = PERCENT_PER_USER.map(
    ({TOTAL, langs}) => 
      Object.entries(langs)
        .map(([k, v]) => ({[k] : v / 100 * Math.log(TOTAL) / Math.log(5)}))
        .reduce((obj, a) => ({...obj, ...a}), {})
  );

  // Sort in ascending order
  let pre = Object.entries(reduceLangObj(WEIGHTED_TOTAL))
    .map(([k, v] : [string, number]) => ({[k] : Math.floor(v * 100) / 100}));

  pre.sort((a, b) => {
    let [[v1], [v2]] = [a, b].map(Object.values);
    return v1 - v2;
  });

  // Write to output, filtering out < 0.5%'s
  await fs.writeFile(
    "./output/weighted.json",
    JSON.stringify(
      pre
        .filter(lang => {
          const [v] = Object.values(lang);
          return v > 0.500
        })
        .reduce((obj, b) => ({...obj, ...b})),
        null, 3
    )
  );
}

main()