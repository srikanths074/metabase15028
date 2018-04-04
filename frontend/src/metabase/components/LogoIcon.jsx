import React, { Component } from "react";
import PropTypes from "prop-types";
import cx from "classnames";

export default class LogoIcon extends Component {
  static defaultProps = {
    size: 32,
  };

  static propTypes = {
    size: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    dark: PropTypes.bool,
  };

  render() {
    let { dark, height, width, size } = this.props;
    return (
      <svg
        className={cx("Icon", { "text-brand": !dark }, { "text-white": dark })}
        viewBox="0 0 66 85"
        width={width || size}
        height={height || size}
        fill="currentcolor"
      >
        <path
          d="M46.8253288,70.4935014 C49.5764899,70.4935014 51.8067467,68.1774705 51.8067467,65.3205017 C51.8067467,62.4635329 49.5764899,60.147502 46.8253288,60.147502 C44.0741676,60.147502 41.8439108,62.4635329 41.8439108,65.3205017 C41.8439108,68.1774705 44.0741676,70.4935014 46.8253288,70.4935014 Z M32.8773585,84.9779005 C35.6285197,84.9779005 37.8587764,82.6618697 37.8587764,79.8049008 C37.8587764,76.947932 35.6285197,74.6319011 32.8773585,74.6319011 C30.1261973,74.6319011 27.8959405,76.947932 27.8959405,79.8049008 C27.8959405,82.6618697 30.1261973,84.9779005 32.8773585,84.9779005 Z M32.8773585,70.4935014 C35.6285197,70.4935014 37.8587764,68.1774705 37.8587764,65.3205017 C37.8587764,62.4635329 35.6285197,60.147502 32.8773585,60.147502 C30.1261973,60.147502 27.8959405,62.4635329 27.8959405,65.3205017 C27.8959405,68.1774705 30.1261973,70.4935014 32.8773585,70.4935014 Z M18.9293882,70.4935014 C21.6805494,70.4935014 23.9108062,68.1774705 23.9108062,65.3205017 C23.9108062,62.4635329 21.6805494,60.147502 18.9293882,60.147502 C16.1782271,60.147502 13.9479703,62.4635329 13.9479703,65.3205017 C13.9479703,68.1774705 16.1782271,70.4935014 18.9293882,70.4935014 Z M46.8253288,56.0091023 C49.5764899,56.0091023 51.8067467,53.6930714 51.8067467,50.8361026 C51.8067467,47.9791337 49.5764899,45.6631029 46.8253288,45.6631029 C44.0741676,45.6631029 41.8439108,47.9791337 41.8439108,50.8361026 C41.8439108,53.6930714 44.0741676,56.0091023 46.8253288,56.0091023 Z M18.9293882,56.0091023 C21.6805494,56.0091023 23.9108062,53.6930714 23.9108062,50.8361026 C23.9108062,47.9791337 21.6805494,45.6631029 18.9293882,45.6631029 C16.1782271,45.6631029 13.9479703,47.9791337 13.9479703,50.8361026 C13.9479703,53.6930714 16.1782271,56.0091023 18.9293882,56.0091023 Z M46.8253288,26.8995984 C49.5764899,26.8995984 51.8067467,24.5835675 51.8067467,21.7265987 C51.8067467,18.8696299 49.5764899,16.553599 46.8253288,16.553599 C44.0741676,16.553599 41.8439108,18.8696299 41.8439108,21.7265987 C41.8439108,24.5835675 44.0741676,26.8995984 46.8253288,26.8995984 Z M32.8773585,41.5247031 C35.6285197,41.5247031 37.8587764,39.2086723 37.8587764,36.3517034 C37.8587764,33.4947346 35.6285197,31.1787037 32.8773585,31.1787037 C30.1261973,31.1787037 27.8959405,33.4947346 27.8959405,36.3517034 C27.8959405,39.2086723 30.1261973,41.5247031 32.8773585,41.5247031 Z M32.8773585,10.3459994 C35.6285197,10.3459994 37.8587764,8.02996853 37.8587764,5.17299969 C37.8587764,2.31603085 35.6285197,0 32.8773585,0 C30.1261973,0 27.8959405,2.31603085 27.8959405,5.17299969 C27.8959405,8.02996853 30.1261973,10.3459994 32.8773585,10.3459994 Z M32.8773585,26.8995984 C35.6285197,26.8995984 37.8587764,24.5835675 37.8587764,21.7265987 C37.8587764,18.8696299 35.6285197,16.553599 32.8773585,16.553599 C30.1261973,16.553599 27.8959405,18.8696299 27.8959405,21.7265987 C27.8959405,24.5835675 30.1261973,26.8995984 32.8773585,26.8995984 Z M18.9293882,26.8995984 C21.6805494,26.8995984 23.9108062,24.5835675 23.9108062,21.7265987 C23.9108062,18.8696299 21.6805494,16.553599 18.9293882,16.553599 C16.1782271,16.553599 13.9479703,18.8696299 13.9479703,21.7265987 C13.9479703,24.5835675 16.1782271,26.8995984 18.9293882,26.8995984 Z"
          opacity="0.2"
        />
        <path d="M60.773299,70.4935014 C63.5244602,70.4935014 65.754717,68.1774705 65.754717,65.3205017 C65.754717,62.4635329 63.5244602,60.147502 60.773299,60.147502 C58.0221379,60.147502 55.7918811,62.4635329 55.7918811,65.3205017 C55.7918811,68.1774705 58.0221379,70.4935014 60.773299,70.4935014 Z M4.98141795,70.3527958 C7.73257912,70.3527958 9.96283591,68.0367649 9.96283591,65.1797961 C9.96283591,62.3228273 7.73257912,60.0067964 4.98141795,60.0067964 C2.23025679,60.0067964 0,62.3228273 0,65.1797961 C0,68.0367649 2.23025679,70.3527958 4.98141795,70.3527958 Z M60.773299,56.0091023 C63.5244602,56.0091023 65.754717,53.6930714 65.754717,50.8361026 C65.754717,47.9791337 63.5244602,45.6631029 60.773299,45.6631029 C58.0221379,45.6631029 55.7918811,47.9791337 55.7918811,50.8361026 C55.7918811,53.6930714 58.0221379,56.0091023 60.773299,56.0091023 Z M32.8773585,56.0091023 C35.6285197,56.0091023 37.8587764,53.6930714 37.8587764,50.8361026 C37.8587764,47.9791337 35.6285197,45.6631029 32.8773585,45.6631029 C30.1261973,45.6631029 27.8959405,47.9791337 27.8959405,50.8361026 C27.8959405,53.6930714 30.1261973,56.0091023 32.8773585,56.0091023 Z M4.98141795,55.8683967 C7.73257912,55.8683967 9.96283591,53.5523658 9.96283591,50.695397 C9.96283591,47.8384281 7.73257912,45.5223973 4.98141795,45.5223973 C2.23025679,45.5223973 0,47.8384281 0,50.695397 C0,53.5523658 2.23025679,55.8683967 4.98141795,55.8683967 Z M60.773299,41.5247031 C63.5244602,41.5247031 65.754717,39.2086723 65.754717,36.3517034 C65.754717,33.4947346 63.5244602,31.1787037 60.773299,31.1787037 C58.0221379,31.1787037 55.7918811,33.4947346 55.7918811,36.3517034 C55.7918811,39.2086723 58.0221379,41.5247031 60.773299,41.5247031 Z M46.8253288,41.5247031 C49.5764899,41.5247031 51.8067467,39.2086723 51.8067467,36.3517034 C51.8067467,33.4947346 49.5764899,31.1787037 46.8253288,31.1787037 C44.0741676,31.1787037 41.8439108,33.4947346 41.8439108,36.3517034 C41.8439108,39.2086723 44.0741676,41.5247031 46.8253288,41.5247031 Z M60.773299,26.8995984 C63.5244602,26.8995984 65.754717,24.5835675 65.754717,21.7265987 C65.754717,18.8696299 63.5244602,16.553599 60.773299,16.553599 C58.0221379,16.553599 55.7918811,18.8696299 55.7918811,21.7265987 C55.7918811,24.5835675 58.0221379,26.8995984 60.773299,26.8995984 Z M18.9293882,41.5247031 C21.6805494,41.5247031 23.9108062,39.2086723 23.9108062,36.3517034 C23.9108062,33.4947346 21.6805494,31.1787037 18.9293882,31.1787037 C16.1782271,31.1787037 13.9479703,33.4947346 13.9479703,36.3517034 C13.9479703,39.2086723 16.1782271,41.5247031 18.9293882,41.5247031 Z M4.98141795,41.3839975 C7.73257912,41.3839975 9.96283591,39.0679667 9.96283591,36.2109978 C9.96283591,33.354029 7.73257912,31.0379981 4.98141795,31.0379981 C2.23025679,31.0379981 0,33.354029 0,36.2109978 C0,39.0679667 2.23025679,41.3839975 4.98141795,41.3839975 Z M4.98141795,26.8995984 C7.73257912,26.8995984 9.96283591,24.5835675 9.96283591,21.7265987 C9.96283591,18.8696299 7.73257912,16.553599 4.98141795,16.553599 C2.23025679,16.553599 0,18.8696299 0,21.7265987 C0,24.5835675 2.23025679,26.8995984 4.98141795,26.8995984 Z" />
      </svg>
    );
  }
}
