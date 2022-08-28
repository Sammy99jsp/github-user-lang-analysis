import { Octokit } from "@octokit/rest";

import {config} from "dotenv";

import * as fs from "fs/promises";

config();

const app = new Octokit({
  auth: process.env.TOKEN,
});


const reduceLangObj = arr => arr.reduce((obj, l) => {
  let tmp = {...obj};

  Object.entries(l)
    .forEach(([key, value]) => tmp = {...tmp, [key] : (tmp[key] ?? 0) + value });

  return tmp;
}, {});

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

  await fs.writeFile(
    "./output/by_name.json",
    JSON.stringify(LANGS, null, 3)
  );

  let lines = reduceLangObj(LANGS.map(({langs}) => langs))

  await fs.writeFile(
    "./output/total.json",
    JSON.stringify(lines, null, 3)
  );

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


  // Calculate total scores by taking a log base 5 of the user's total lines

  const WEIGHTED_TOTAL = PERCENT_PER_USER.map(
    ({TOTAL, langs}) => 
      Object.entries(langs)
        .map(([k, v]) => ({[k] : v / 100 * Math.log(TOTAL) / Math.log(5)}))
        .reduce((obj, a) => ({...obj, ...a}), {})
  );



  let pre = Object.entries(reduceLangObj(WEIGHTED_TOTAL))
    .map(([k, v] : [string, number]) => ({[k] : Math.floor(v * 100) / 100}));

  pre.sort((a, b) => {
    let [[v1], [v2]] = [a, b].map(Object.values);
    return v1 - v2;
  });

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

// main()

main()